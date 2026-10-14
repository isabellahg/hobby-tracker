import type { Session } from '../types/session'

/**
 * Any finished session qualifies for a daily activity mark, regardless of
 * how many tasks were completed. Discarded (and still in-progress) sessions
 * never qualify.
 */
export function isQualifyingSession(session: Session): boolean {
  return session.state === 'finished'
}
