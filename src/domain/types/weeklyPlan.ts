import type { DayOfWeek, ID, ISODateTimeString } from './common'

/**
 * A single advisory singleton row (id is always 'default'). This is never
 * read as a gate anywhere in the app — it only seeds "today's suggestions"
 * on the Home screen.
 */
export interface WeeklyPlan {
  id: 'default'
  assignments: Partial<Record<DayOfWeek, ID[]>>
  updatedAt: ISODateTimeString
}

export function emptyWeeklyPlan(now: ISODateTimeString): WeeklyPlan {
  return { id: 'default', assignments: {}, updatedAt: now }
}
