import { format, parseISO } from 'date-fns'
import type { DayActivity } from '../../domain/logic/activity'
import { formatDuration } from '../../lib/format'

/** Tooltip / screen-reader text for a calendar day. */
export function dayTitle(date: string, day: DayActivity | undefined): string {
  const when = format(parseISO(date), 'EEE d MMM yyyy')
  if (!day) return `${when} · nothing logged`
  const n = day.sessionIds.length
  return `${when} · ${formatDuration(day.sec)} · ${n} session${n === 1 ? '' : 's'}`
}
