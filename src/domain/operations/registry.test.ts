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

  it('starting a bucket names the session after it, archives nothing, and deletes the bucket', async () => {
    const ctx = makeContext({ now: new Date('2026-10-14T19:00:00.000Z') })
    const oneOff = await createTask('One-off', 'once', ctx)
    const recurring = await createTask('Habit', 'recurring', ctx)
    const bucket = await applyOperation(
      { operation: 'bucket.create', payload: { name: 'Tonight', taskDefIds: [oneOff, recurring] } },
      ctx,
    )
    const bucketId = bucket.changes[0].id

    const started = await applyOperation({ operation: 'session.startFromBucket', payload: { bucketId } }, ctx)
    expect(started.success).toBe(true)

    const sessionId = started.changes.find((c) => c.store === 'sessions')!.id
    const session = await db.sessions.get(sessionId)
    expect(session?.name).toBe('Tonight')
    expect(session?.taskEntries.map((e) => e.label).sort()).toEqual(['Habit', 'One-off'])
    expect(session?.routineId).toBeUndefined()
    expect((await db.taskDefs.get(oneOff))?.archived).toBe(false)
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

async function createTask(label: string, kind: 'once' | 'recurring' | 'ongoing', ctx = makeContext()) {
  const res = await applyOperation({ operation: 'taskDef.create', payload: { label, kind } }, ctx)
  return res.changes[0].id
}

/** Starts a bucket session with the given tasks, completes the listed labels, and finishes it. */
async function runBucketSession(taskDefIds: string[], completeLabels: string[], ctx = makeContext()) {
  const bucket = await applyOperation({ operation: 'bucket.create', payload: { name: 'B', taskDefIds } }, ctx)
  const started = await applyOperation(
    { operation: 'session.startFromBucket', payload: { bucketId: bucket.changes[0].id } },
    ctx,
  )
  const sessionId = started.changes.find((c) => c.store === 'sessions')!.id
  for (const label of completeLabels) {
    await applyOperation({ operation: 'session.setTaskStatus', payload: { sessionId, label, status: 'completed' } }, ctx)
  }
  await applyOperation({ operation: 'session.finish', payload: { sessionId } }, ctx)
  return sessionId
}

describe('task kinds leaving the backlog', () => {
  it('a one-off completed in a bucket session is archived on finish', async () => {
    const id = await createTask('Study artworks', 'once')
    await runBucketSession([id], ['Study artworks'])
    expect((await db.taskDefs.get(id))?.archived).toBe(true)
  })

  it('a one-off left unchecked stays in the backlog', async () => {
    const id = await createTask('Not today', 'once')
    await runBucketSession([id], [])
    expect((await db.taskDefs.get(id))?.archived).toBe(false)
  })

  it('a one-off completed in a routine session stays, since routine tasks repeat', async () => {
    const ctx = makeContext()
    const id = await createTask('Routine step', 'once', ctx)
    const routine = await applyOperation(
      { operation: 'routine.create', payload: { name: 'R', taskDefIds: [id] } },
      ctx,
    )
    const started = await applyOperation(
      { operation: 'session.start', payload: { routineId: routine.changes[0].id } },
      ctx,
    )
    const sessionId = started.changes[0].id
    await applyOperation(
      { operation: 'session.setTaskStatus', payload: { sessionId, label: 'Routine step', status: 'completed' } },
      ctx,
    )
    await applyOperation({ operation: 'session.finish', payload: { sessionId } }, ctx)
    expect((await db.taskDefs.get(id))?.archived).toBe(false)
  })

  it('recurring and ongoing tasks are never auto-archived, even when completed', async () => {
    const habit = await createTask('Habit', 'recurring')
    const course = await createTask('Course', 'ongoing')
    await runBucketSession([habit, course], ['Habit', 'Course'])
    expect((await db.taskDefs.get(habit))?.archived).toBe(false)
    expect((await db.taskDefs.get(course))?.archived).toBe(false)
  })

  it('taskDef.finish archives an ongoing task and records a linked milestone', async () => {
    const ctx = makeContext({ now: new Date('2026-10-14T12:00:00') })
    const course = await createTask('Anatomy course', 'ongoing', ctx)
    const result = await applyOperation({ operation: 'taskDef.finish', payload: { id: course } }, ctx)
    expect(result.success).toBe(true)
    expect((await db.taskDefs.get(course))?.archived).toBe(true)
    const records = await db.personalRecords.toArray()
    expect(records).toHaveLength(1)
    expect(records[0].taskDefId).toBe(course)
    expect(records[0].description).toBe('Finished "Anatomy course"')
    expect(records[0].date).toBe('2026-10-14')
  })

  it('taskDef.finish refuses a non-ongoing task', async () => {
    const id = await createTask('One-off', 'once')
    const result = await applyOperation({ operation: 'taskDef.finish', payload: { id } }, makeContext())
    expect(result.success).toBe(false)
  })

  it('restoring an archived task brings it back', async () => {
    const id = await createTask('Archived', 'once')
    await applyOperation({ operation: 'taskDef.archive', payload: { id, archived: true } }, makeContext())
    await applyOperation({ operation: 'taskDef.archive', payload: { id, archived: false } }, makeContext())
    expect((await db.taskDefs.get(id))?.archived).toBe(false)
  })

  it('a task can be switched from one-off to recurring after creation', async () => {
    const id = await createTask('artwod practice', 'once')
    await applyOperation({ operation: 'taskDef.update', payload: { id, kind: 'recurring' } }, makeContext())
    expect((await db.taskDefs.get(id))?.kind).toBe('recurring')
  })
})

describe('session rename, renameTask, and delete', () => {
  it('renames a session and one of its task entries without touching the library task', async () => {
    const ctx = makeContext()
    const id = await createTask('Sketch', 'recurring', ctx)
    const sessionId = await runBucketSession([id], [], ctx)

    await applyOperation({ operation: 'session.rename', payload: { sessionId, name: 'Evening sketching' } }, ctx)
    const entryId = (await db.sessions.get(sessionId))!.taskEntries[0].id
    await applyOperation(
      { operation: 'session.renameTask', payload: { sessionId, entryId, label: 'Gesture sketch' } },
      ctx,
    )

    const session = await db.sessions.get(sessionId)
    expect(session?.name).toBe('Evening sketching')
    expect(session?.taskEntries[0].label).toBe('Gesture sketch')
    expect((await db.taskDefs.get(id))?.label).toBe('Sketch')
  })

  it('deleting the only session of a day removes that day\'s mark', async () => {
    const ctx = makeContext({ now: new Date('2026-10-14T12:00:00') })
    const start = await applyOperation({ operation: 'session.start', payload: {} }, ctx)
    const sessionId = start.changes[0].id
    await applyOperation({ operation: 'session.finish', payload: { sessionId } }, ctx)

    const deleted = await applyOperation({ operation: 'session.delete', payload: { sessionId } }, ctx)
    expect(deleted.success).toBe(true)

    const calendar = await applyOperation(
      { operation: 'query.calendar', payload: { start: '2026-10-14', end: '2026-10-14' } },
      ctx,
    )
    const data = calendar.data as { marks: { hasMark: boolean }[] }
    expect(data.marks[0].hasMark).toBe(false)
  })

  it('refuses to delete a session that is still in progress', async () => {
    const start = await applyOperation({ operation: 'session.start', payload: {} }, makeContext())
    const result = await applyOperation(
      { operation: 'session.delete', payload: { sessionId: start.changes[0].id } },
      makeContext(),
    )
    expect(result.success).toBe(false)
    expect(await db.sessions.get(start.changes[0].id)).toBeDefined()
  })
})

describe('routines on Home: next-run extras', () => {
  async function makeRoutine(name: string, taskDefIds: string[], ctx = makeContext()) {
    const res = await applyOperation({ operation: 'routine.create', payload: { name, taskDefIds } }, ctx)
    return res.changes[0].id
  }

  it('seeds a session with the routine tasks plus extras, then clears the extras', async () => {
    const ctx = makeContext()
    const own = await createTask('Read while waiting', 'recurring', ctx)
    const extra = await createTask('Draw the dragon', 'once', ctx)
    const routineId = await makeRoutine('Mientras trabajo', [own], ctx)

    const added = await applyOperation({ operation: 'routine.addExtraTask', payload: { routineId, taskDefId: extra } }, ctx)
    expect(added.success).toBe(true)
    expect((await db.routines.get(routineId))?.extraTaskRefs?.map((r) => r.taskDefId)).toEqual([extra])

    const started = await applyOperation({ operation: 'session.start', payload: { routineId } }, ctx)
    const session = await db.sessions.get(started.changes[0].id)
    expect(session?.taskEntries.map((e) => e.label)).toEqual(['Read while waiting', 'Draw the dragon'])

    const routine = await db.routines.get(routineId)
    expect(routine?.extraTaskRefs).toEqual([])
    expect(routine?.taskRefs.map((r) => r.taskDefId)).toEqual([own])
  })

  it('archives a completed one-off extra but never a routine member', async () => {
    const ctx = makeContext()
    const member = await createTask('Member', 'once', ctx)
    const extra = await createTask('Extra', 'once', ctx)
    const routineId = await makeRoutine('R', [member], ctx)
    await applyOperation({ operation: 'routine.addExtraTask', payload: { routineId, taskDefId: extra } }, ctx)
    const started = await applyOperation({ operation: 'session.start', payload: { routineId } }, ctx)
    const sessionId = started.changes[0].id
    for (const label of ['Member', 'Extra']) {
      await applyOperation({ operation: 'session.setTaskStatus', payload: { sessionId, label, status: 'completed' } }, ctx)
    }
    await applyOperation({ operation: 'session.finish', payload: { sessionId } }, ctx)
    expect((await db.taskDefs.get(member))?.archived).toBe(false)
    expect((await db.taskDefs.get(extra))?.archived).toBe(true)
  })

  it('keepExtraTask promotes an extra into the routine for good', async () => {
    const ctx = makeContext()
    const extra = await createTask('Now permanent', 'recurring', ctx)
    const routineId = await makeRoutine('R', [], ctx)
    await applyOperation({ operation: 'routine.addExtraTask', payload: { routineId, taskDefId: extra } }, ctx)
    await applyOperation({ operation: 'routine.keepExtraTask', payload: { routineId, taskDefId: extra } }, ctx)
    const routine = await db.routines.get(routineId)
    expect(routine?.taskRefs.map((r) => r.taskDefId)).toEqual([extra])
    expect(routine?.extraTaskRefs).toEqual([])
  })

  it('removeExtraTask drops an extra without touching the task', async () => {
    const ctx = makeContext()
    const extra = await createTask('Maybe not', 'once', ctx)
    const routineId = await makeRoutine('R', [], ctx)
    await applyOperation({ operation: 'routine.addExtraTask', payload: { routineId, taskDefId: extra } }, ctx)
    await applyOperation({ operation: 'routine.removeExtraTask', payload: { routineId, taskDefId: extra } }, ctx)
    expect((await db.routines.get(routineId))?.extraTaskRefs).toEqual([])
    expect((await db.taskDefs.get(extra))?.archived).toBe(false)
  })
})

describe('running session: add backlog tasks and tag it', () => {
  it('adds a library task with its open subtasks nested under it', async () => {
    const ctx = makeContext()
    const parent = await createTask('Course', 'ongoing', ctx)
    const child = await applyOperation(
      { operation: 'taskDef.create', payload: { label: 'Chapter 1', parentId: parent } },
      ctx,
    )
    const started = await applyOperation({ operation: 'session.start', payload: {} }, ctx)
    const sessionId = started.changes[0].id

    const res = await applyOperation({ operation: 'session.addTask', payload: { sessionId, taskDefId: parent } }, ctx)
    expect(res.success).toBe(true)
    const session = await db.sessions.get(sessionId)
    const parentEntry = session!.taskEntries.find((e) => e.taskDefId === parent)!
    const childEntry = session!.taskEntries.find((e) => e.taskDefId === child.changes[0].id)!
    expect(childEntry.parentEntryId).toBe(parentEntry.id)

    const again = await applyOperation({ operation: 'session.addTask', payload: { sessionId, taskDefId: parent } }, ctx)
    expect(again.changes).toHaveLength(0)
  })

  it('refuses to add tasks to a finished session', async () => {
    const ctx = makeContext()
    const task = await createTask('Late', 'once', ctx)
    const started = await applyOperation({ operation: 'session.start', payload: {} }, ctx)
    const sessionId = started.changes[0].id
    await applyOperation({ operation: 'session.finish', payload: { sessionId } }, ctx)
    const res = await applyOperation({ operation: 'session.addTask', payload: { sessionId, taskDefId: task } }, ctx)
    expect(res.success).toBe(false)
  })

  it('tags a flexible session', async () => {
    const ctx = makeContext()
    const started = await applyOperation({ operation: 'session.start', payload: {} }, ctx)
    const sessionId = started.changes[0].id
    await applyOperation({ operation: 'session.setTags', payload: { sessionId, hobbyIds: ['h1'], skillIds: ['s1', 's2'] } }, ctx)
    const session = await db.sessions.get(sessionId)
    expect(session?.hobbyIds).toEqual(['h1'])
    expect(session?.skillIds).toEqual(['s1', 's2'])
  })
})

describe('task media', () => {
  it('attaches a link and a picture, and removes one', async () => {
    const ctx = makeContext()
    const task = await createTask('Study refs', 'once', ctx)
    const link = await applyOperation(
      { operation: 'taskDef.addMedia', payload: { taskDefId: task, kind: 'link', src: 'https://youtu.be/abc123' } },
      ctx,
    )
    const pic = await applyOperation(
      { operation: 'taskDef.addMedia', payload: { taskDefId: task, kind: 'image', src: 'data:image/png;base64,iVBORw0KGgo=' } },
      ctx,
    )
    expect(link.success && pic.success).toBe(true)
    expect(await db.taskMedia.count()).toBe(2)

    await applyOperation({ operation: 'taskDef.removeMedia', payload: { id: link.changes[0].id } }, ctx)
    expect(await db.taskMedia.count()).toBe(1)
  })

  it('rejects non-http links and non-image data', async () => {
    const ctx = makeContext()
    const task = await createTask('X', 'once', ctx)
    const js = await applyOperation(
      { operation: 'taskDef.addMedia', payload: { taskDefId: task, kind: 'link', src: 'javascript:alert(1)' } },
      ctx,
    )
    const html = await applyOperation(
      { operation: 'taskDef.addMedia', payload: { taskDefId: task, kind: 'image', src: 'data:text/html;base64,PGI+' } },
      ctx,
    )
    expect(js.success).toBe(false)
    expect(html.success).toBe(false)
  })

  it('fills in a link title and preview picture after it is attached', async () => {
    const ctx = makeContext()
    const task = await createTask('Refs', 'once', ctx)
    const link = await applyOperation(
      { operation: 'taskDef.addMedia', payload: { taskDefId: task, kind: 'link', src: 'https://artstation.com/a/1' } },
      ctx,
    )
    const id = link.changes[0].id
    const updated = await applyOperation(
      { operation: 'taskDef.updateMedia', payload: { id, title: 'Dragon study', preview: 'https://cdn.example.com/og.jpg' } },
      ctx,
    )
    expect(updated.success).toBe(true)
    expect(await db.taskMedia.get(id)).toMatchObject({ title: 'Dragon study', preview: 'https://cdn.example.com/og.jpg' })

    const bad = await applyOperation(
      { operation: 'taskDef.updateMedia', payload: { id, preview: 'javascript:alert(1)' } },
      ctx,
    )
    expect(bad.success).toBe(false)
  })
})
