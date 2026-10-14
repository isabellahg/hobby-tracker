import { addDays, addWeeks as dfAddWeeks, eachDayOfInterval, format, parseISO, startOfWeek } from 'date-fns'
import type { DayOfWeek, ISODateString } from '../types/common'

const DATE_FORMAT = 'yyyy-MM-dd'

/** Monday 00:00 local time of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function addWeeks(date: Date, n: number): Date {
  return dfAddWeeks(date, n)
}

export function toISODate(d: Date): ISODateString {
  return format(d, DATE_FORMAT)
}

export function fromISODate(s: ISODateString): Date {
  return parseISO(s)
}

/** The Sunday (inclusive end) of the week that starts on `weekStart`. */
export function getWeekEnd(weekStart: Date): Date {
  return addDays(weekStart, 6)
}

/** Every calendar date from `start` to `end`, inclusive, as ISO date strings. */
export function enumerateDates(range: { start: ISODateString; end: ISODateString }): ISODateString[] {
  return eachDayOfInterval({ start: fromISODate(range.start), end: fromISODate(range.end) }).map(toISODate)
}

/** Monday = 0 ... Sunday = 6, remapped from JS `Date#getDay()` (Sunday = 0). */
export function getDayOfWeek(date: Date): DayOfWeek {
  const jsDay = date.getDay()
  return ((jsDay + 6) % 7) as DayOfWeek
}

/** Every Monday from `start` to `end`, inclusive, as ISO date strings. */
export function enumerateWeekStarts(start: ISODateString, end: ISODateString): ISODateString[] {
  const result: ISODateString[] = []
  let cursor = getWeekStart(fromISODate(start))
  const last = getWeekStart(fromISODate(end))
  while (cursor <= last) {
    result.push(toISODate(cursor))
    cursor = addWeeks(cursor, 1)
  }
  return result
}
