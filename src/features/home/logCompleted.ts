import { format, parseISO } from 'date-fns'
import { run } from '../../state/actions'
import { useAppStore } from '../../state/store'
import { useToasts } from '../../state/toast'
import type { Session } from '../../domain/types/session'
import { sessionTitle } from '../session/sessionTitle'

/** Sessions a task can be logged in: what's running, then the most recent finished ones. */
export function loggableSessions(sessions: Session[], limit = 10): Session[] {
  const running = sessions.filter((s) => s.state === 'in_progress')
  const finished = sessions
    .filter((s) => s.state === 'finished')
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, limit)
  return [...running, ...finished]
}

export function sessionWhen(session: Session): string {
  return session.state === 'in_progress' ? 'now' : format(parseISO(session.startedAt), 'EEE d MMM')
}

/** "I did this but forgot to add it" — logs the task as completed in that session and says so. */
export async function logCompleted(taskDefId: string, session: Session) {
  const { taskDefs, routines } = useAppStore.getState()
  const label = taskDefs.find((t) => t.id === taskDefId)?.label ?? 'Task'
  const title = sessionTitle(session, routines)
  const result = await run({ operation: 'session.logCompletedTask', payload: { sessionId: session.id, taskDefId } })
  const toast = useToasts.getState().show
  if (!result.success) {
    toast({ message: result.errors?.[0]?.message ?? `Could not log "${label}"`, tone: 'error' })
  } else if (result.changes.length === 0) {
    toast({ message: `"${label}" was already done in ${title}` })
  } else {
    toast({
      message: `✓ "${label}" logged in ${title} (${sessionWhen(session)})`,
      link: { to: `/session/${session.id}`, label: 'Open' },
    })
  }
}
