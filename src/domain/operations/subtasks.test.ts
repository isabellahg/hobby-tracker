import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../storage/db'
import { applyBatch, applyOperation } from './registry'
import { makeContext } from './context'

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
})

const ctx = makeContext({ now: new Date('2026-10-15T09:00:00.000Z') })

async function create(label: string, extra: Record<string, unknown> = {}) {
  const res = await applyOperation({ operation: 'taskDef.create', payload: { label, ...extra } }, ctx)
  expect(res.success).toBe(true)
  return res.changes[0].id
}

async function startBucket(taskDefIds: string[]) {
  const bucket = await applyOperation({ operation: 'bucket.create', payload: { name: 'B', taskDefIds } }, ctx)
  const started = await applyOperation(
    { operation: 'session.startFromBucket', payload: { bucketId: bucket.changes[0].id } },
    ctx,
  )
  return started.changes.find((c) => c.store === 'sessions')!.id
}

describe('subtasks: taskDef ops', () => {
  it('a subtask inherits its parent tags unless given its own', async () => {
    const hobby = await applyOperation({ operation: 'hobby.create', payload: { name: 'Art' } }, ctx)
    const parent = await create('Portfolio', { hobbyIds: [hobby.changes[0].id] })
    const inherited = await create('Pick pieces', { parentId: parent })
    const own = await create('Own tags', { parentId: parent, hobbyIds: [] })
    expect((await db.taskDefs.get(inherited))).toMatchObject({ parentId: parent, hobbyIds: [hobby.changes[0].id] })
    expect((await db.taskDefs.get(own))?.hobbyIds).toEqual([])
  })

  it('rejects a missing or archived parent', async () => {
    const missing = await applyOperation({ operation: 'taskDef.create', payload: { label: 'x', parentId: 'nope' } }, ctx)
    expect(missing.success).toBe(false)
    const parent = await create('Closed')
    await applyOperation({ operation: 'taskDef.archive', payload: { id: parent, archived: true } }, ctx)
    const res = await applyOperation({ operation: 'taskDef.create', payload: { label: 'x', parentId: parent } }, ctx)
    expect(res.success).toBe(false)
  })

  it('creates a parent and its subtasks in one batch via $ref', async () => {
    const res = await applyBatch(
      {
        version: 1,
        operations: [
          { operation: 'taskDef.create', payload: { label: 'Parent' } },
          { operation: 'taskDef.create', payload: { label: 'Child', parentId: '$ref:0' } },
        ],
      },
      ctx,
    )
    expect(res.success).toBe(true)
    const child = await db.taskDefs.get(res.results[1].changes[0].id)
    expect(child?.parentId).toBe(res.results[0].changes[0].id)
  })

  it('re-parents, rejects cycles, and null moves a task to the top level', async () => {
    const a = await create('A')
    const b = await create('B', { parentId: a })
    const c = await create('C')

    const cycle = await applyOperation({ operation: 'taskDef.update', payload: { id: a, parentId: b } }, ctx)
    expect(cycle.success).toBe(false)
    const self = await applyOperation({ operation: 'taskDef.update', payload: { id: a, parentId: a } }, ctx)
    expect(self.success).toBe(false)

    await applyOperation({ operation: 'taskDef.update', payload: { id: b, parentId: c } }, ctx)
    expect((await db.taskDefs.get(b))?.parentId).toBe(c)
    await applyOperation({ operation: 'taskDef.update', payload: { id: b, parentId: null } }, ctx)
    expect((await db.taskDefs.get(b))?.parentId).toBeUndefined()
    // Untouched parentId survives an unrelated edit.
    const d = await create('D', { parentId: a })
    await applyOperation({ operation: 'taskDef.update', payload: { id: d, label: 'D2' } }, ctx)
    expect((await db.taskDefs.get(d))?.parentId).toBe(a)
  })

  it('archiving a parent closes its whole open tree; restoring does not cascade', async () => {
    const a = await create('A')
    const b = await create('B', { parentId: a })
    const c = await create('C', { parentId: b })
    const res = await applyOperation({ operation: 'taskDef.archive', payload: { id: a, archived: true } }, ctx)
    expect(res.changes).toHaveLength(3)
    expect((await db.taskDefs.get(c))?.archived).toBe(true)

    await applyOperation({ operation: 'taskDef.archive', payload: { id: a, archived: false } }, ctx)
    expect((await db.taskDefs.get(a))?.archived).toBe(false)
    expect((await db.taskDefs.get(b))?.archived).toBe(true)
  })

  it('finishing an ongoing parent closes its subtasks too', async () => {
    const course = await create('Course', { kind: 'ongoing' })
    const lesson = await create('Lesson 1', { parentId: course })
    const res = await applyOperation({ operation: 'taskDef.finish', payload: { id: course } }, ctx)
    expect(res.success).toBe(true)
    expect((await db.taskDefs.get(lesson))?.archived).toBe(true)
  })
})

describe('subtasks: sessions', () => {
  it('a bucketed parent brings its open subtasks, nested and without duplicates', async () => {
    const parent = await create('Parent')
    const child = await create('Child', { parentId: parent })
    const grandchild = await create('Grandchild', { parentId: child })
    const closed = await create('Closed', { parentId: parent })
    await applyOperation({ operation: 'taskDef.archive', payload: { id: closed, archived: true } }, ctx)

    const sessionId = await startBucket([parent, child])
    const session = await db.sessions.get(sessionId)
    const byLabel = new Map(session!.taskEntries.map((e) => [e.label, e]))
    expect(session!.taskEntries.map((e) => e.label)).toEqual(['Parent', 'Child', 'Grandchild'])
    expect(byLabel.get('Child')?.parentEntryId).toBe(byLabel.get('Parent')?.id)
    expect(byLabel.get('Grandchild')?.parentEntryId).toBe(byLabel.get('Child')?.id)
    expect(byLabel.get('Parent')?.parentEntryId).toBeUndefined()
    expect(grandchild).toBeTruthy()
  })

  it('a subtask bucketed on its own is not nested', async () => {
    const parent = await create('Parent')
    const child = await create('Child', { parentId: parent })
    const session = await db.sessions.get(await startBucket([child]))
    expect(session!.taskEntries).toHaveLength(1)
    expect(session!.taskEntries[0].parentEntryId).toBeUndefined()
  })

  it('finishing a session with a completed one-off parent archives its subtree', async () => {
    const parent = await create('Parent')
    const child = await create('Child', { parentId: parent })
    const sessionId = await startBucket([parent])
    const session = await db.sessions.get(sessionId)
    const childEntry = session!.taskEntries.find((e) => e.label === 'Child')!
    // Completing the only child auto-completes the parent.
    await applyOperation({ operation: 'session.toggleTask', payload: { sessionId, entryId: childEntry.id } }, ctx)
    expect((await db.sessions.get(sessionId))!.taskEntries.every((e) => e.status === 'completed')).toBe(true)

    const finished = await applyOperation({ operation: 'session.finish', payload: { sessionId } }, ctx)
    expect(finished.success).toBe(true)
    expect((await db.taskDefs.get(parent))?.archived).toBe(true)
    expect((await db.taskDefs.get(child))?.archived).toBe(true)
  })

  it('session.addSubtask creates a real child task and nests a new entry', async () => {
    const parent = await create('Parent')
    const sessionId = await startBucket([parent])
    const parentEntry = (await db.sessions.get(sessionId))!.taskEntries[0]
    const res = await applyOperation(
      { operation: 'session.addSubtask', payload: { sessionId, parentEntryId: parentEntry.id, label: 'Split off' } },
      ctx,
    )
    expect(res.success).toBe(true)
    const session = await db.sessions.get(sessionId)
    const entry = session!.taskEntries.find((e) => e.label === 'Split off')!
    expect(entry.parentEntryId).toBe(parentEntry.id)
    expect(entry.isAdHoc).toBe(false)
    expect((await db.taskDefs.get(entry.taskDefId!))?.parentId).toBe(parent)
  })

  it('session.addSubtask under an ad-hoc entry stays ad hoc', async () => {
    const sessionId = await startBucket([await create('Anything')])
    await applyOperation({ operation: 'session.addAdHocTask', payload: { sessionId, label: 'Loose' } }, ctx)
    const loose = (await db.sessions.get(sessionId))!.taskEntries.find((e) => e.label === 'Loose')!
    await applyOperation(
      { operation: 'session.addSubtask', payload: { sessionId, parentEntryId: loose.id, label: 'Bit' } },
      ctx,
    )
    const bit = (await db.sessions.get(sessionId))!.taskEntries.find((e) => e.label === 'Bit')!
    expect(bit).toMatchObject({ isAdHoc: true, parentEntryId: loose.id })
    expect(bit.taskDefId).toBeUndefined()
  })
})
