import { create } from 'zustand'
import type { Hobby } from '../domain/types/hobby'
import type { Skill } from '../domain/types/skill'
import type { TaskDef } from '../domain/types/taskDef'
import type { Routine } from '../domain/types/routine'
import { emptyWeeklyPlan, type WeeklyPlan } from '../domain/types/weeklyPlan'
import type { Session } from '../domain/types/session'
import type { Project } from '../domain/types/project'
import type { PersonalRecord } from '../domain/types/record'
import type { PlanBucket } from '../domain/types/planBucket'
import { nowISO } from '../domain/types/common'
import {
  hobbyRepo,
  planBucketRepo,
  projectRepo,
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
  projects: Project[]
  personalRecords: PersonalRecord[]
  planBuckets: PlanBucket[]
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
  projects: [],
  personalRecords: [],
  planBuckets: [],
  setAll: (partial) => set(partial),
  load: async () => {
    const [hobbies, skills, taskDefs, routines, weeklyPlan, sessions, projects, personalRecords, planBuckets] =
      await Promise.all([
        hobbyRepo.getAll(),
        skillRepo.getAll(),
        taskDefRepo.getAll(),
        routineRepo.getAll(),
        weeklyPlanRepo.get(),
        sessionRepo.getAll(),
        projectRepo.getAll(),
        recordRepo.getAll(),
        planBucketRepo.getAll(),
      ])
    set({
      loaded: true,
      hobbies,
      skills,
      taskDefs,
      routines,
      weeklyPlan,
      sessions,
      projects,
      personalRecords,
      planBuckets,
    })
  },
}))
