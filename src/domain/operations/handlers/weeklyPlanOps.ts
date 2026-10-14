import type { DayOfWeek } from '../../types/common'
import { weeklyPlanRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type { weeklyPlanUpdateSchema } from '../validate/weeklyPlan'
import type { z } from 'zod'

export async function handleWeeklyPlanUpdate(
  payload: z.infer<typeof weeklyPlanUpdateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await weeklyPlanRepo.get()
  const assignments = { ...existing.assignments }
  for (const { day, routineIds } of payload.set) {
    assignments[day as DayOfWeek] = routineIds
  }
  const updated = { ...existing, assignments, updatedAt: ctx.now.toISOString() }
  await weeklyPlanRepo.put(updated)
  return {
    changes: [{ store: 'weeklyPlan', id: 'default', changeType: 'updated', before: existing, after: updated }],
    summary: `Update weekly plan for ${payload.set.length} day(s) (advisory only — never enforced)`,
  }
}
