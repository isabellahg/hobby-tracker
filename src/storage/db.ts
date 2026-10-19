import Dexie, { type Table } from 'dexie'
import type { Hobby } from '../domain/types/hobby'
import type { Skill } from '../domain/types/skill'
import type { TaskDef } from '../domain/types/taskDef'
import type { Routine } from '../domain/types/routine'
import type { WeeklyPlan } from '../domain/types/weeklyPlan'
import type { Session } from '../domain/types/session'
import type { PersonalRecord } from '../domain/types/record'
import type { PlanBucket } from '../domain/types/planBucket'
import type { TaskMedia } from '../domain/types/taskMedia'

export interface MetaRow {
  key: string
  value: unknown
}

/** Shapes of rows written by older schema versions, used only by upgrades. */
type LegacyTaskDef = Partial<TaskDef> & { isRecurring?: boolean }
interface LegacyProject {
  id: string
  name: string
  description?: string
  hobbyIds?: string[]
  skillIds?: string[]
  nextAction?: string
  status?: 'active' | 'completed' | 'archived'
  createdAt?: string
  updatedAt?: string
}

export class HobbyTrackerDB extends Dexie {
  hobbies!: Table<Hobby, string>
  skills!: Table<Skill, string>
  taskDefs!: Table<TaskDef, string>
  routines!: Table<Routine, string>
  weeklyPlan!: Table<WeeklyPlan, string>
  sessions!: Table<Session, string>
  personalRecords!: Table<PersonalRecord, string>
  meta!: Table<MetaRow, string>
  planBuckets!: Table<PlanBucket, string>
  taskMedia!: Table<TaskMedia, string>

  constructor(name = 'HobbyTrackerDB') {
    super(name)
    this.version(1).stores({
      hobbies: 'id, archived',
      skills: 'id, hobbyId, archived',
      taskDefs: 'id, *skillIds, archived',
      routines: 'id, *hobbyIds, *skillIds, archived',
      weeklyPlan: 'id',
      sessions: 'id, dateKey, routineId, projectId, state, *hobbyIds, *skillIds, startedAt',
      projects: 'id, status, *hobbyIds, *skillIds',
      personalRecords: 'id, hobbyId, skillId, date',
      meta: 'key',
    })

    // v2: tasks gained independent hobby tags + a recurring flag, and plan
    // buckets were added.
    this.version(2)
      .stores({
        taskDefs: 'id, *hobbyIds, *skillIds, archived',
        planBuckets: 'id, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('taskDefs')
          .toCollection()
          .modify((taskDef: LegacyTaskDef) => {
            if (!taskDef.hobbyIds) taskDef.hobbyIds = []
            if (taskDef.isRecurring === undefined) taskDef.isRecurring = false
          })
      })

    // v3: `isRecurring` became the three-way `kind`, and projects were folded
    // into ongoing tasks. The projects table is still declared here so the
    // upgrade can read it; it's dropped in v4.
    this.version(3).stores({}).upgrade(async (tx) => {
      await tx
        .table('taskDefs')
        .toCollection()
        .modify((taskDef: LegacyTaskDef) => {
          if (taskDef.kind === undefined) taskDef.kind = taskDef.isRecurring ? 'recurring' : 'once'
          delete taskDef.isRecurring
        })

      const projects: LegacyProject[] = await tx.table('projects').toArray()
      const now = new Date().toISOString()
      for (const p of projects) {
        const asTask: TaskDef = {
          id: p.id,
          label: p.name,
          description: p.description,
          hobbyIds: p.hobbyIds ?? [],
          skillIds: p.skillIds ?? [],
          kind: 'ongoing',
          nextAction: p.nextAction,
          archived: p.status !== undefined && p.status !== 'active',
          createdAt: p.createdAt ?? now,
          updatedAt: now,
        }
        await tx.table('taskDefs').put(asTask)
      }
    })

    this.version(4).stores({
      projects: null,
      sessions: 'id, dateKey, routineId, state, *hobbyIds, *skillIds, startedAt',
    })

    // v5: pictures and links attached to tasks.
    this.version(5).stores({
      taskMedia: 'id, taskDefId',
    })
  }
}

export const db = new HobbyTrackerDB()

export const ALL_TABLE_NAMES = [
  'hobbies',
  'skills',
  'taskDefs',
  'routines',
  'weeklyPlan',
  'sessions',
  'personalRecords',
  'planBuckets',
  'taskMedia',
] as const

export type TableName = (typeof ALL_TABLE_NAMES)[number]
