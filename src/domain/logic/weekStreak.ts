import type { ISODateString } from '../types/common'
import type { WeekStreakState } from '../types/derived'
import type { Session } from '../types/session'
import { isQualifyingSession } from './qualifyingSession'
import { addDays, format } from 'date-fns'
import { enumerateWeekStarts, fromISODate, getWeekStart, toISODate } from './weekUtils'

export interface WeekQual {
  weekStart: ISODateString
  qualifies: boolean
  activeDays: number
  isCurrentInProgress: boolean
}

/**
 * One entry per Monday-aligned week from `earliestWeekStart` to
 * `currentWeekStart` inclusive. The last entry is always the week
 * containing "now" and is flagged `isCurrentInProgress`.
 */
export function buildWeekQualifications(
  qualifyingDateKeys: Set<ISODateString>,
  earliestWeekStart: ISODateString,
  currentWeekStart: ISODateString,
): WeekQual[] {
  const weekStarts = enumerateWeekStarts(earliestWeekStart, currentWeekStart)
  return weekStarts.map((weekStart) => {
    const start = fromISODate(weekStart)
    let activeDays = 0
    for (let i = 0; i < 7; i++) {
      const dateKey = format(addDays(start, i), 'yyyy-MM-dd')
      if (qualifyingDateKeys.has(dateKey)) activeDays++
    }
    return {
      weekStart,
      qualifies: activeDays > 0,
      activeDays,
      isCurrentInProgress: weekStart === currentWeekStart,
    }
  })
}

/**
 * Walk backward from the latest week. If the latest week is in-progress and
 * still empty, skip it (an unfinished week neither extends nor breaks the
 * streak yet). Then count consecutive qualifying weeks until the first
 * non-qualifying *completed* week stops the count.
 */
export function computeCurrentStreak(weeks: WeekQual[]): number {
  if (weeks.length === 0) return 0
  let i = weeks.length - 1
  const last = weeks[i]
  if (last.isCurrentInProgress && !last.qualifies) {
    i -= 1
  }
  let streak = 0
  for (; i >= 0; i--) {
    if (weeks[i].qualifies) streak++
    else break
  }
  return streak
}

/**
 * The longest run of consecutive qualifying weeks ever seen. An empty
 * in-progress week is excluded from the scan (it hasn't failed yet), but a
 * qualifying in-progress week is included since it may already be a new
 * record in the making.
 */
export function computeLongestStreak(weeks: WeekQual[], currentStreak: number): number {
  const scanWeeks = weeks.filter((w) => !w.isCurrentInProgress || w.qualifies)
  let best = 0
  let run = 0
  for (const w of scanWeeks) {
    run = w.qualifies ? run + 1 : 0
    best = Math.max(best, run)
  }
  return Math.max(best, currentStreak)
}

export function computeWeekStreak(sessions: Session[], now: Date = new Date()): WeekStreakState {
  const qualifyingDateKeys = new Set(sessions.filter(isQualifyingSession).map((s) => s.dateKey))
  const currentWeekStart = toISODate(getWeekStart(now))

  let earliestWeekStart = currentWeekStart
  if (qualifyingDateKeys.size > 0) {
    const earliestDateKey = [...qualifyingDateKeys].sort()[0]
    earliestWeekStart = toISODate(getWeekStart(fromISODate(earliestDateKey)))
  }

  const weeks = buildWeekQualifications(qualifyingDateKeys, earliestWeekStart, currentWeekStart)
  const currentStreak = computeCurrentStreak(weeks)
  const longestStreak = computeLongestStreak(weeks, currentStreak)
  const weekActiveDays = weeks[weeks.length - 1]?.activeDays ?? 0

  return { currentStreak, longestStreak, currentWeekStart, weekActiveDays }
}
