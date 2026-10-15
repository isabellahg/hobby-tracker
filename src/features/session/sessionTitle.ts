import type { Routine } from '../../domain/types/routine'
import type { Session } from '../../domain/types/session'

export function sessionTitle(session: Session, routines: Routine[]): string {
  if (session.name) return session.name
  const routine = session.routineId ? routines.find((r) => r.id === session.routineId) : undefined
  return routine?.name ?? 'Flexible session'
}
