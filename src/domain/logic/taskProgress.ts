import type { ID } from '../types/common'
import type { Session } from '../types/session'
import { isQualifyingSession } from './qualifyingSession'

/** How many finished sessions included this task — drives "ongoing · N sessions". */
export function countSessionsForTask(sessions: Session[], taskDefId: ID): number {
  return sessions.filter(
    (s) => isQualifyingSession(s) && s.taskEntries.some((e) => e.taskDefId === taskDefId),
  ).length
}
