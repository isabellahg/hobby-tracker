import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../storage/db'
import { applyBatch, applyOperation } from './registry'
import { makeContext } from './context'

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
})

describe('applyOperation', () => {
  it('rejects an unknown operation', async () => {
    // @ts-expect-error intentionally invalid for the test
    const result = await applyOperation({ operation: 'nope.nope', payload: {} }, makeContext())
    expect(result.success).toBe(false)
    expect(result.errors?.[0].message).toMatch(/Unknown operation/)
  })

  it('rejects an invalid payload with a clear field-level error', async () => {
    const result = await applyOperation({ operation: 'hobby.create', payload: {} }, makeContext())
    expect(result.success).toBe(false)
    expect(result.errors?.[0].path).toBe('name')
  })

  it('creates a hobby and persists it', async () => {
    const result = await applyOperation(
      { operation: 'hobby.create', payload: { name: 'Game dev' } },
      makeContext(),
    )
    expect(result.success).toBe(true)
    expect(result.changes).toHaveLength(1)
    const stored = await db.hobbies.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('Game dev')
  })

  it('dryRun computes the change preview without writing anything', async () => {
    const result = await applyOperation(
      { operation: 'hobby.create', payload: { name: 'Piano' }, dryRun: true },
      makeContext({ dryRun: true }),
    )
    expect(result.success).toBe(true)
    expect(result.changes).toHaveLength(1)
    const stored = await db.hobbies.toArray()
    expect(stored).toHaveLength(0)
  })

  it('is idempotent on a repeated requestId', async () => {
    const req = { operation: 'hobby.create' as const, payload: { name: 'Drawing' }, requestId: 'req-1' }
    const first = await applyOperation(req, makeContext())
    const second = await applyOperation(req, makeContext())
    expect(first.changes).toHaveLength(1)
    expect(second.changes).toHaveLength(0)
    expect(second.summary).toMatch(/already applied/)
    const stored = await db.hobbies.toArray()
    expect(stored).toHaveLength(1)
  })

  it('never exposes a way to fabricate a calendar mark directly', async () => {
    // @ts-expect-error intentionally invalid for the test
    const result = await applyOperation({ operation: 'calendar.setMark', payload: {} }, makeContext())
    expect(result.success).toBe(false)
  })
})

describe('full lifecycle via operations: hobby -> routine -> session -> finish', () => {
  it('produces a calendar mark only after a real session.finish, matching history', async () => {
    const ctx = makeContext({ now: new Date('2026-10-13T09:00:00.000Z') })

    const hobbyRes = await applyOperation({ operation: 'hobby.create', payload: { name: 'Art' } }, ctx)
    const hobbyId = hobbyRes.changes[0].id

    const skillRes = await applyOperation(
      { operation: 'skill.create', payload: { hobbyId, name: 'Anatomy' } },
      ctx,
    )
    const skillId = skillRes.changes[0].id

    const taskRes = await applyOperation(
      { operation: 'taskDef.create', payload: { label: 'Sketch', skillIds: [skillId] } },
      ctx,
    )
    const taskDefId = taskRes.changes[0].id

    const routineRes = await applyOperation(
      {
        operation: 'routine.create',
        payload: { name: 'Boss recreation', hobbyIds: [hobbyId], skillIds: [skillId], taskDefIds: [taskDefId] },
      },
      ctx,
    )
    const routineId = routineRes.changes[0].id

    const startRes = await applyOperation({ operation: 'session.start', payload: { routineId } }, ctx)
    const sessionId = startRes.changes[0].id

    // Finish without completing the single task — a partial session still qualifies.
    const finishRes = await applyOperation({ operation: 'session.finish', payload: { sessionId } }, ctx)
    expect(finishRes.success).toBe(true)

    const calendarRes = await applyOperation(
      { operation: 'query.calendar', payload: { start: '2026-10-12', end: '2026-10-14' } },
      ctx,
    )
    const data = calendarRes.data as { marks: { date: string; hasMark: boolean }[]; streak: { currentStreak: number } }
    expect(data.marks.find((m) => m.date === '2026-10-13')?.hasMark).toBe(true)
    expect(data.streak.currentStreak).toBe(1)

    const historyRes = await applyOperation({ operation: 'query.history', payload: {} }, ctx)
    const history = historyRes.data as { sessions: { id: string }[] }
    expect(history.sessions.map((s) => s.id)).toContain(sessionId)
  })

  it('a discarded session never produces a mark', async () => {
    const ctx = makeContext({ now: new Date('2026-10-13T09:00:00.000Z') })
    const startRes = await applyOperation({ operation: 'session.start', payload: {} }, ctx)
    const sessionId = startRes.changes[0].id
    await applyOperation({ operation: 'session.discard', payload: { sessionId } }, ctx)

    const calendarRes = await applyOperation(
      { operation: 'query.calendar', payload: { start: '2026-10-12', end: '2026-10-14' } },
      ctx,
    )
    const data = calendarRes.data as { marks: { date: string; hasMark: boolean }[] }
    expect(data.marks.find((m) => m.date === '2026-10-13')?.hasMark).toBe(false)
  })

  it('backdates a session via occurredAt/finishedAt and marks tasks complete by label', async () => {
    // Applied "now" is the 14th, but the session itself happened on the 13th.
    const ctx = makeContext({ now: new Date('2026-10-14T12:00:00.000Z') })

    const taskRes = await applyOperation(
      { operation: 'taskDef.create', payload: { label: 'Sketch silhouette' } },
      ctx,
    )
    const routineRes = await applyOperation(
      { operation: 'routine.create', payload: { name: 'Drawing', taskDefIds: [taskRes.changes[0].id] } },
      ctx,
    )
    const startRes = await applyOperation(
      {
        operation: 'session.start',
        payload: { routineId: routineRes.changes[0].id, occurredAt: '2026-10-13T18:00:00.000Z' },
      },
      ctx,
    )
    const sessionId = startRes.changes[0].id

    const statusRes = await applyOperation(
      { operation: 'session.setTaskStatus', payload: { sessionId, label: 'Sketch silhouette', status: 'completed' } },
      ctx,
    )
    expect(statusRes.success).toBe(true)

    const finishRes = await applyOperation(
      { operation: 'session.finish', payload: { sessionId, finishedAt: '2026-10-13T20:00:00.000Z' } },
      ctx,
    )
    expect(finishRes.success).toBe(true)

    const stored = await db.sessions.get(sessionId)
    expect(stored?.dateKey).toBe('2026-10-13')
    expect(stored?.durationSec).toBe(2 * 60 * 60)
    expect(stored?.taskEntries[0].status).toBe('completed')

    // The mark lands on the 13th (when it happened), not the 14th (when it was logged).
    const calendarRes = await applyOperation(
      { operation: 'query.calendar', payload: { start: '2026-10-12', end: '2026-10-14' } },
      ctx,
    )
    const data = calendarRes.data as { marks: { date: string; hasMark: boolean }[] }
    expect(data.marks.find((m) => m.date === '2026-10-13')?.hasMark).toBe(true)
    expect(data.marks.find((m) => m.date === '2026-10-14')?.hasMark).toBe(false)
  })

  it('rejects an unrecognized task label for session.setTaskStatus', async () => {
    const ctx = makeContext({ now: new Date('2026-10-14T12:00:00.000Z') })
    const startRes = await applyOperation({ operation: 'session.start', payload: {} }, ctx)
    const result = await applyOperation(
      {
        operation: 'session.setTaskStatus',
        payload: { sessionId: startRes.changes[0].id, label: 'Nonexistent', status: 'completed' },
      },
      ctx,
    )
    expect(result.success).toBe(false)
  })
})

describe('applyBatch', () => {
  it('non-atomic: reports partial success per operation', async () => {
    const result = await applyBatch(
      {
        version: 1,
        operations: [
          { operation: 'hobby.create', payload: { name: 'Valid' } },
          { operation: 'hobby.create', payload: {} }, // invalid
        ],
      },
      makeContext(),
    )
    expect(result.success).toBe(false)
    expect(result.results[0].success).toBe(true)
    expect(result.results[1].success).toBe(false)
    const stored = await db.hobbies.toArray()
    expect(stored).toHaveLength(1) // the valid one still landed
  })

  it('atomic: rolls back every operation if one fails', async () => {
    const result = await applyBatch(
      {
        version: 1,
        atomic: true,
        operations: [
          { operation: 'hobby.create', payload: { name: 'Valid' } },
          { operation: 'hobby.create', payload: {} }, // invalid, aborts the transaction
        ],
      },
      makeContext(),
    )
    expect(result.success).toBe(false)
    const stored = await db.hobbies.toArray()
    expect(stored).toHaveLength(0)
  })

  it('resolves $ref markers to ids created earlier in the same batch, even during dry-run', async () => {
    const batch = {
      version: 1 as const,
      operations: [
        { operation: 'hobby.create' as const, payload: { name: 'Art' } },
        { operation: 'skill.create' as const, payload: { hobbyId: '$ref:0', name: 'Anatomy' } },
        {
          operation: 'routine.create' as const,
          payload: { name: 'Boss recreation', hobbyIds: ['$ref:0'], skillIds: ['$ref:1'], taskDefIds: [] },
        },
      ],
    }

    const preview = await applyBatch(batch, makeContext({ dryRun: true }))
    expect(preview.success).toBe(true)
    expect(await db.hobbies.count()).toBe(0) // nothing persisted during preview

    const applied = await applyBatch(batch, makeContext())
    expect(applied.success).toBe(true)
    const routine = (await db.routines.toArray())[0]
    const hobby = (await db.hobbies.toArray())[0]
    const skill = (await db.skills.toArray())[0]
    expect(routine.hobbyIds).toEqual([hobby.id])
    expect(routine.skillIds).toEqual([skill.id])
    expect(skill.hobbyId).toBe(hobby.id)
  })
})

describe('plan buckets and session.startFromBucket', () => {
  it('creates a bucket with initial tasks and reorders/moves tasks via add/remove', async () => {
    const ctx = makeContext()
    const t1 = await applyOperation({ operation: 'taskDef.create', payload: { label: 'A' } }, ctx)
    const t2 = await applyOperation({ operation: 'taskDef.create', payload: { label: 'B' } }, ctx)

    const created = await applyOperation(
      { operation: 'bucket.create', payload: { name: 'Tonight', taskDefIds: [t1.changes[0].id] } },
      ctx,
    )
    expect(created.success).toBe(true)
    const bucketId = created.changes[0].id

    const added = await applyOperation(
      { operation: 'bucket.addTask', payload: { bucketId, taskDefId: t2.changes[0].id } },
      ctx,
    )
    expect(added.success).toBe(true)
    let bucket = await db.planBuckets.get(bucketId)
    expect(bucket?.taskRefs.map((r) => r.taskDefId)).toEqual([t1.changes[0].id, t2.changes[0].id])

    await applyOperation(
      { operation: 'bucket.removeTask', payload: { bucketId, taskDefId: t1.changes[0].id } },
      ctx,
    )
    bucket = await db.planBuckets.get(bucketId)
    expect(bucket?.taskRefs.map((r) => r.taskDefId)).toEqual([t2.changes[0].id])
  })

  it('removing a task from a bucket never touches the task itself — it stays in the backlog', async () => {
    const ctx = makeContext()
    const t1 = await applyOperation({ operation: 'taskDef.create', payload: { label: 'Stays visible' } }, ctx)
    const bucket = await applyOperation(
      { operation: 'bucket.create', payload: { name: 'X', taskDefIds: [t1.changes[0].id] } },
      ctx,
    )
    await applyOperation(
      { operation: 'bucket.removeTask', payload: { bucketId: bucket.changes[0].id, taskDefId: t1.changes[0].id } },
      ctx,
    )
    const taskDef = await db.taskDefs.get(t1.changes[0].id)
    expect(taskDef?.archived).toBe(false)
  })

  it('starting a bucket archives a one-off task but keeps a recurring one active, and deletes the bucket', async () => {
    const ctx = makeContext({ now: new Date('2026-10-14T19:00:00.000Z') })
    const oneOff = await applyOperation(
      { operation: 'taskDef.create', payload: { label: 'One-off', isRecurring: false } },
      ctx,
    )
    const recurring = await applyOperation(
      { operation: 'taskDef.create', payload: { label: 'Habit', isRecurring: true } },
      ctx,
    )
    const bucket = await applyOperation(
      {
        operation: 'bucket.create',
        payload: { name: 'Tonight', taskDefIds: [oneOff.changes[0].id, recurring.changes[0].id] },
      },
      ctx,
    )
    const bucketId = bucket.changes[0].id

    const started = await applyOperation(
      { operation: 'session.startFromBucket', payload: { bucketId } },
      ctx,
    )
    expect(started.success).toBe(true)

    const sessionId = started.changes.find((c) => c.store === 'sessions')!.id
    const session = await db.sessions.get(sessionId)
    expect(session?.taskEntries.map((e) => e.label).sort()).toEqual(['Habit', 'One-off'])
    expect(session?.routineId).toBeUndefined()

    const oneOffAfter = await db.taskDefs.get(oneOff.changes[0].id)
    const recurringAfter = await db.taskDefs.get(recurring.changes[0].id)
    expect(oneOffAfter?.archived).toBe(true)
    expect(recurringAfter?.archived).toBe(false)

    expect(await db.planBuckets.get(bucketId)).toBeUndefined()
  })

  it('backdates a bucket-started session the same way session.start does', async () => {
    const ctx = makeContext({ now: new Date('2026-10-14T12:00:00.000Z') })
    const task = await applyOperation({ operation: 'taskDef.create', payload: { label: 'Yesterday task' } }, ctx)
    const bucket = await applyOperation(
      { operation: 'bucket.create', payload: { name: 'X', taskDefIds: [task.changes[0].id] } },
      ctx,
    )
    const started = await applyOperation(
      {
        operation: 'session.startFromBucket',
        payload: { bucketId: bucket.changes[0].id, occurredAt: '2026-10-13T18:00:00' },
      },
      ctx,
    )
    const sessionId = started.changes.find((c) => c.store === 'sessions')!.id
    const session = await db.sessions.get(sessionId)
    expect(session?.dateKey).toBe('2026-10-13')
  })
})
