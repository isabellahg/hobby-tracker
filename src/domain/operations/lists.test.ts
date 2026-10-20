import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../storage/db'
import { applyOperation } from './registry'
import { makeContext } from './context'
import type { OperationRequest } from './envelope'

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
})

async function ok(req: OperationRequest, now = new Date('2026-10-20T10:00:00.000Z')) {
  const r = await applyOperation(req, makeContext({ now }))
  if (!r.success) throw new Error(r.errors?.[0]?.message)
  return r
}

async function makeList(name = 'Reading') {
  return (await ok({ operation: 'list.create', payload: { name } })).changes[0].id
}

async function makeItem(payload: Record<string, unknown>) {
  return (await ok({ operation: 'taskDef.create', payload })).changes[0].id
}

describe('lists', () => {
  it('creates list items as "want to", off the backlog', async () => {
    const listId = await makeList()
    const id = await makeItem({ label: 'Dune', listId })
    expect(await db.taskDefs.get(id)).toMatchObject({ listId, status: 'want', archived: false })
  })

  it('setStatus stamps the time, and done records a milestone without archiving', async () => {
    const listId = await makeList()
    const id = await makeItem({ label: 'Dune', listId })
    await ok({ operation: 'taskDef.setStatus', payload: { id, status: 'ongoing' } }, new Date('2026-10-21T00:00:00.000Z'))
    expect((await db.taskDefs.get(id))?.statusAt).toBe('2026-10-21T00:00:00.000Z')
    await ok({ operation: 'taskDef.setStatus', payload: { id, status: 'done' } })
    expect(await db.taskDefs.get(id)).toMatchObject({ status: 'done', archived: false })
    expect(await db.personalRecords.toArray()).toHaveLength(1)
  })

  it('removing a list item from the backlog keeps it on the list', async () => {
    const listId = await makeList()
    const id = await makeItem({ label: 'Dune', listId, inBacklog: true })
    await ok({ operation: 'taskDef.update', payload: { id, inBacklog: false } })
    expect(await db.taskDefs.get(id)).toMatchObject({ listId, inBacklog: false, archived: false })
  })

  it('finishing a session marks a completed one-off list item done instead of archiving it', async () => {
    const listId = await makeList('Watch')
    const id = await makeItem({ label: 'Alien', listId, inBacklog: true })
    const bucketId = (await ok({ operation: 'bucket.create', payload: { name: 'Movie night', taskDefIds: [id] } })).changes[0].id
    const sessionId = (await ok({ operation: 'session.startFromBucket', payload: { bucketId } })).changes[0].id
    const entryId = (await db.sessions.get(sessionId))!.taskEntries[0].id
    await ok({ operation: 'session.toggleTask', payload: { sessionId, entryId } })
    await ok({ operation: 'session.finish', payload: { sessionId } })
    expect(await db.taskDefs.get(id)).toMatchObject({ status: 'done', inBacklog: false, archived: false })
  })

  it('habits refuse done', async () => {
    const id = await makeItem({ label: 'Scales', kind: 'recurring' })
    const r = await applyOperation({ operation: 'taskDef.setStatus', payload: { id, status: 'done' } }, makeContext())
    expect(r.success).toBe(false)
  })

  it('archiving a list keeps its items', async () => {
    const listId = await makeList()
    const id = await makeItem({ label: 'Dune', listId })
    await ok({ operation: 'list.archive', payload: { id: listId, archived: true } })
    expect((await db.lists.get(listId))?.archived).toBe(true)
    expect((await db.taskDefs.get(id))?.listId).toBe(listId)
  })
})

describe('taskDef.moveTo', () => {
  it('turns a task into a habit with a default frequency', async () => {
    const id = await makeItem({ label: 'Scales' })
    await ok({ operation: 'taskDef.moveTo', payload: { id, target: 'habits' } })
    expect(await db.taskDefs.get(id)).toMatchObject({ kind: 'recurring', status: 'ongoing', habit: { period: 'week' } })
  })

  it('moves a habit onto a list and back to the backlog', async () => {
    const listId = await makeList()
    const id = await makeItem({ label: 'Scales', kind: 'recurring' })
    await ok({ operation: 'taskDef.moveTo', payload: { id, target: listId } })
    const onList = await db.taskDefs.get(id)
    expect(onList).toMatchObject({ kind: 'once', listId, status: 'want' })
    expect(onList?.habit).toBeUndefined()
    await ok({ operation: 'taskDef.moveTo', payload: { id, target: 'backlog' } })
    const back = await db.taskDefs.get(id)
    expect(back?.listId).toBeUndefined()
    expect(back?.status).toBeUndefined()
  })

  it('rejects an unknown list', async () => {
    const id = await makeItem({ label: 'X' })
    const r = await applyOperation({ operation: 'taskDef.moveTo', payload: { id, target: 'nope' } }, makeContext())
    expect(r.success).toBe(false)
  })
})
