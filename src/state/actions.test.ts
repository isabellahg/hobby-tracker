import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../storage/db'
import { run } from './actions'

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
})

describe('run', () => {
  it('does not lose an update when two operations are fired at once', async () => {
    const a = await run({ operation: 'taskDef.create', payload: { label: 'A' } })
    const b = await run({ operation: 'taskDef.create', payload: { label: 'B' } })
    const bucket = await run({
      operation: 'bucket.create',
      payload: { name: 'X', taskDefIds: [a.changes[0].id, b.changes[0].id] },
    })
    const started = await run({ operation: 'session.startFromBucket', payload: { bucketId: bucket.changes[0].id } })
    const session = await db.sessions.get(started.changes[0].id)
    const [entryA, entryB] = session!.taskEntries

    // Like tapping two checkboxes in quick succession.
    await Promise.all([
      run({ operation: 'session.toggleTask', payload: { sessionId: session!.id, entryId: entryA.id } }),
      run({ operation: 'session.toggleTask', payload: { sessionId: session!.id, entryId: entryB.id } }),
    ])

    const after = await db.sessions.get(session!.id)
    expect(after!.taskEntries.map((e) => e.status)).toEqual(['completed', 'completed'])
  })
})
