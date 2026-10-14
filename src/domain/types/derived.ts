import type { ID, ISODateString } from './common'

/** Computed on read from Session data — never persisted. */
export interface DayMark {
  date: ISODateString
  hasMark: boolean
  sessionIds: ID[]
}

/** Computed on read from Session data — never persisted. */
export interface WeekStreakState {
  currentStreak: number
  longestStreak: number
  currentWeekStart: ISODateString
  weekActiveDays: number
}
