export type ID = string

/** Calendar date, no time component, e.g. "2026-10-13". */
export type ISODateString = string

/** Full timestamp, e.g. "2026-10-13T18:04:12.000Z". */
export type ISODateTimeString = string

/**
 * Monday = 0 ... Sunday = 6. This is NOT the same as JS `Date#getDay()`
 * (which is Sunday = 0); always convert through `weekUtils.ts`, never
 * read `getDay()` directly elsewhere in the codebase.
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export function newId(): ID {
  return crypto.randomUUID()
}

export function nowISO(): ISODateTimeString {
  return new Date().toISOString()
}
