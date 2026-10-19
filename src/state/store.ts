import { create } from 'zustand'
import type { Hobby } from '../domain/types/hobby'
import type { Skill } from '../domain/types/skill'
import type { TaskDef } from '../domain/types/taskDef'
import type { Routine } from '../domain/types/routine'
import { emptyWeeklyPlan, type WeeklyPlan } from '../domain/types/weeklyPlan'
import type { Session } from '../domain/types/session'
import type { PersonalRecord } from '../domain/types/record'
import type { PlanBucket } from '../domain/types/planBucket'
import type { TaskMedia } from '../domain/types/taskMedia'
import { nowISO } from '../domain/types/common'
import {
  hobbyRepo,
  planBucketRepo,
  taskMediaRepo,
  recordRepo,
  routineRepo,
  sessionRepo,
  skillRepo,
  taskDefRepo,
  weeklyPlanRepo,
} from '../storage/repositories'

export interface AppState {
  loaded: boolean
  hobbies: Hobby[]
  skills: Skill[]
  taskDefs: TaskDef[]
  routines: Routine[]
  weeklyPlan: WeeklyPlan
  sessions: Session[]
  personalRecords: PersonalRecord[]
  planBuckets: PlanBucket[]
  taskMedia: TaskMedia[]
  setAll: (partial: Partial<Omit<AppState, 'loaded' | 'setAll' | 'load'>>) => void
  load: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  loaded: false,
  hobbies: [],
  skills: [],
  taskDefs: [],
  routines: [],
  weeklyPlan: emptyWeeklyPlan(nowISO()),
  sessions: [],
  personalRecords: [],
  planBuckets: [],
  taskMedia: [],
  setAll: (partial) => set(partial),
  load: async () => {
    const [hobbies, skills, taskDefs, routines, weeklyPlan, sessions, personalRecords, planBuckets, taskMedia] =
      await Promise.all([
        hobbyRepo.getAll(),
        skillRepo.getAll(),
        taskDefRepo.getAll(),
        routineRepo.getAll(),
        weeklyPlanRepo.get(),
        sessionRepo.getAll(),
        recordRepo.getAll(),
        planBucketRepo.getAll(),
        taskMediaRepo.getAll(),
      ])
    set({
      loaded: true,
      hobbies,
      skills,
      taskDefs,
      routines,
      weeklyPlan,
      sessions,
      personalRecords,
      planBuckets,
      taskMedia,
    })
  },
}))
