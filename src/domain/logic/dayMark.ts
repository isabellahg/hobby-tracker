import type { ID, ISODateString } from '../types/common'
import type { DayMark } from '../types/derived'
import type { Session } from '../types/session'
import { isQualifyingSession } from './qualifyingSession'
import { enumerateDates } from './weekUtils'

/**
 * One mark per calendar day: multiple qualifying sessions on the same day
 * still collapse to a single DayMark with all their ids attached.
 */
export function computeDayMarks(
  sessions: Session[],
  range: { start: ISODateString; end: ISODateString },
): DayMark[] {
  const byDate = new Map<ISODateString, ID[]>()
  for (const s of sessions) {
    if (!isQualifyingSession(s)) continue
    if (s.dateKey < range.start || s.dateKey > range.end) continue
    const existing = byDate.get(s.dateKey) ?? []
    existing.push(s.id)
    byDate.set(s.dateKey, existing)
  }
  return enumerateDates(range).map((date) => ({
    date,
    hasMark: byDate.has(date),
    sessionIds: byDate.get(date) ?? [],
  }))
}

export function hasMarkOnDate(sessions: Session[], date: ISODateString): boolean {
  return sessions.some((s) => isQualifyingSession(s) && s.dateKey === date)
}
