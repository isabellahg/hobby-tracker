import Dexie, { type Table } from 'dexie'
import type { Hobby } from '../domain/types/hobby'
import type { Skill } from '../domain/types/skill'
import type { TaskDef } from '../domain/types/taskDef'
import type { Routine } from '../domain/types/routine'
import type { WeeklyPlan } from '../domain/types/weeklyPlan'
import type { Session } from '../domain/types/session'
import type { Project } from '../domain/types/project'
import type { PersonalRecord } from '../domain/types/record'
import type { PlanBucket } from '../domain/types/planBucket'

export interface MetaRow {
  key: string
  value: unknown
}

export class HobbyTrackerDB extends Dexie {
  hobbies!: Table<Hobby, string>
  skills!: Table<Skill, string>
  taskDefs!: Table<TaskDef, string>
  routines!: Table<Routine, string>
  weeklyPlan!: Table<WeeklyPlan, string>
  sessions!: Table<Session, string>
  projects!: Table<Project, string>
  personalRecords!: Table<PersonalRecord, string>
  meta!: Table<MetaRow, string>
  planBuckets!: Table<PlanBucket, string>

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

    // v2: tasks gained independent hobby tags + a recurring flag (for the
    // Home backlog/planning-bucket flow), and plan buckets were added.
    this.version(2)
      .stores({
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
      })
      .upgrade(async (tx) => {
        await tx
          .table('taskDefs')
          .toCollection()
          .modify((taskDef: Partial<TaskDef>) => {
            if (!taskDef.hobbyIds) taskDef.hobbyIds = []
            if (taskDef.isRecurring === undefined) taskDef.isRecurring = false
          })
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
  'projects',
  'personalRecords',
  'planBuckets',
] as const

export type TableName = (typeof ALL_TABLE_NAMES)[number]
