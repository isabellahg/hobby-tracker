import { addDays, addMonths, endOfMonth, endOfYear, format, startOfMonth, startOfYear } from 'date-fns'
import type { ID, ISODateString } from '../types/common'
import type { Session } from '../types/session'
import { isQualifyingSession } from './qualifyingSession'
import { fromISODate, getWeekStart, toISODate } from './weekUtils'

/** Practice on one calendar day. Computed on read — never persisted. */
export interface DayActivity {
  sec: number
  sessionIds: ID[]
}

export interface ActivityFilter {
  hobbyId?: ID
  skillId?: ID
}

function matches(session: Session, filter: ActivityFilter): boolean {
  if (filter.hobbyId && !session.hobbyIds.includes(filter.hobbyId)) return false
  if (filter.skillId && !session.skillIds.includes(filter.skillId)) return false
  return true
}

/** Qualifying sessions grouped by the day they count towards. */
export function activityByDate(sessions: Session[], filter: ActivityFilter = {}): Map<ISODateString, DayActivity> {
  const byDate = new Map<ISODateString, DayActivity>()
  for (const s of sessions) {
    if (!isQualifyingSession(s) || !matches(s, filter)) continue
    const day = byDate.get(s.dateKey) ?? { sec: 0, sessionIds: [] }
    day.sec += s.durationSec ?? 0
    day.sessionIds.push(s.id)
    byDate.set(s.dateKey, day)
  }
  return byDate
}

/**
 * Shade for a calendar cell, 0–4. Fixed thresholds (not relative to your best
 * day) so a colour means the same thing in every month and year.
 */
export function intensityLevel(day: DayActivity | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!day || day.sessionIds.length === 0) return 0
  const min = day.sec / 60
  if (min < 30) return 1
  if (min < 60) return 2
  if (min < 120) return 3
  return 4
}

/** Monday-first weeks spanning first..last; days outside that range are null. */
function weeksCovering(first: Date, last: Date): (ISODateString | null)[][] {
  const weeks: (ISODateString | null)[][] = []
  let cursor = getWeekStart(first)
  while (cursor <= last) {
    const week: (ISODateString | null)[] = []
    for (let i = 0; i < 7; i++) {
      const day = addDays(cursor, i)
      week.push(day >= first && day <= last ? toISODate(day) : null)
    }
    weeks.push(week)
    cursor = addDays(cursor, 7)
  }
  return weeks
}

/** The rows of a month calendar. */
export function monthWeeks(monthStart: Date): (ISODateString | null)[][] {
  return weeksCovering(startOfMonth(monthStart), endOfMonth(monthStart))
}

/** The columns of a year heatmap. */
export function yearWeeks(year: number): (ISODateString | null)[][] {
  const first = startOfYear(new Date(year, 0, 1))
  return weeksCovering(first, endOfYear(first))
}

export type PeriodUnit = 'week' | 'month'

export interface PeriodTotal {
  /** First day of the period. */
  start: ISODateString
  label: string
  sec: number
  sessions: number
  activeDays: number
}

/** Time practised per week or month, oldest first, ending with the one containing `now`. */
export function periodTotals(
  byDate: Map<ISODateString, DayActivity>,
  unit: PeriodUnit,
  count: number,
  now: Date,
): PeriodTotal[] {
  const currentStart = unit === 'week' ? getWeekStart(now) : startOfMonth(now)
  const periods: PeriodTotal[] = []
  for (let i = count - 1; i >= 0; i--) {
    const start = unit === 'week' ? addDays(currentStart, -7 * i) : addMonths(currentStart, -i)
    const end = unit === 'week' ? addDays(start, 6) : endOfMonth(start)
    periods.push({
      start: toISODate(start),
      label: unit === 'week' ? format(start, 'd MMM') : format(start, 'MMM'),
      sec: 0,
      sessions: 0,
      activeDays: 0,
    })
    const period = periods[periods.length - 1]
    const startKey = toISODate(start)
    const endKey = toISODate(end)
    for (const [date, day] of byDate) {
      if (date < startKey || date > endKey) continue
      period.sec += day.sec
      period.sessions += day.sessionIds.length
      period.activeDays += 1
    }
  }
  return periods
}

/** Total time per tag id across qualifying sessions (a session counts fully towards each of its tags). */
export function timeByTag(sessions: Session[], pick: (s: Session) => ID[]): Record<ID, { sec: number; sessions: number }> {
  const totals: Record<ID, { sec: number; sessions: number }> = {}
  for (const s of sessions) {
    if (!isQualifyingSession(s)) continue
    for (const id of pick(s)) {
      const t = (totals[id] ??= { sec: 0, sessions: 0 })
      t.sec += s.durationSec ?? 0
      t.sessions += 1
    }
  }
  return totals
}

export function isValidISODate(value: string | null): value is ISODateString {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(fromISODate(value).getTime())
}
