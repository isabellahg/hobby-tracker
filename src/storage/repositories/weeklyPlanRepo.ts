import { db } from '../db'
import { emptyWeeklyPlan, type WeeklyPlan } from '../../domain/types/weeklyPlan'
import { nowISO } from '../../domain/types/common'

export const weeklyPlanRepo = {
  async get(): Promise<WeeklyPlan> {
    const row = await db.weeklyPlan.get('default')
    return row ?? emptyWeeklyPlan(nowISO())
  },
  async put(plan: WeeklyPlan): Promise<void> {
    await db.weeklyPlan.put(plan)
  },
}
