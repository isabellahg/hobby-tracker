import type { ISODateString } from '../types/common'
import type { Session, SessionState } from '../types/session'

let counter = 0

export function makeSession(
  dateKey: ISODateString,
  state: SessionState = 'finished',
  overrides: Partial<Session> = {},
): Session {
  counter += 1
  return {
    id: `session-${counter}`,
    hobbyIds: [],
    skillIds: [],
    taskEntries: [],
    startedAt: `${dateKey}T10:00:00.000Z`,
    pausedIntervals: [],
    state,
    dateKey,
    finishedAt: state === 'finished' ? `${dateKey}T10:30:00.000Z` : undefined,
    discardedAt: state === 'discarded' ? `${dateKey}T10:05:00.000Z` : undefined,
    ...overrides,
  }
}
