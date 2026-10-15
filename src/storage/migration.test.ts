import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { HobbyTrackerDB } from './db'

const V2_STORES = {
  hobbies: 'id, archived',
  skills: 'id, hobbyId, archived',
  taskDefs: 'id, *hobbyIds, *skillIds, archived',
  routines: 'id, *hobbyIds, *skillIds, archived',
  weeklyPlan: 'id',
  sessions: 'id, dateKey, routineId, projectId, state, *hobbyIds, *skillIds, startedAt',
  projects: 'id, status, *hobbyIds, *skillIds',
  personalRecords: 'id, hobbyId, skillId, date',
  meta: 'key',
  planBuckets: 'id, updatedAt',
}

describe('schema upgrade from v2', () => {
  it('converts isRecurring to kind, folds projects into ongoing tasks, and keeps sessions', async () => {
    const name = 'MigrationTestDB'
    const legacy = new Dexie(name)
    legacy.version(2).stores(V2_STORES)
    await legacy.open()
    await legacy.table('taskDefs').bulkPut([
      { id: 't1', label: 'artwod practice', hobbyIds: [], skillIds: [], isRecurring: true, archived: false },
      { id: 't2', label: 'draw dnd character', hobbyIds: [], skillIds: [], isRecurring: false, archived: false },
    ])
    await legacy.table('projects').bulkPut([
      { id: 'p1', name: 'Anatomy course', hobbyIds: ['h1'], skillIds: [], nextAction: 'Ch. 7', status: 'active' },
      { id: 'p2', name: 'Old project', hobbyIds: [], skillIds: [], status: 'completed' },
    ])
    await legacy.table('sessions').put({
      id: 's1', dateKey: '2026-10-13', state: 'finished', hobbyIds: [], skillIds: [],
      taskEntries: [], startedAt: '2026-10-13T18:00:00', pausedIntervals: [],
    })
    legacy.close()

    const db = new HobbyTrackerDB(name)
    await db.open()

    const t1 = await db.taskDefs.get('t1')
    const t2 = await db.taskDefs.get('t2')
    expect(t1?.kind).toBe('recurring')
    expect(t2?.kind).toBe('once')
    expect(t1).not.toHaveProperty('isRecurring')

    const course = await db.taskDefs.get('p1')
    expect(course).toMatchObject({ label: 'Anatomy course', kind: 'ongoing', nextAction: 'Ch. 7', archived: false })
    expect((await db.taskDefs.get('p2'))?.archived).toBe(true)

    expect(db.tables.map((t) => t.name)).not.toContain('projects')
    expect(await db.sessions.get('s1')).toBeDefined()
    db.close()
  })
})
