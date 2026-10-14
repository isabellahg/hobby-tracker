import { newId } from '../types/common'
import type { Project } from '../types/project'
import type { Session, SessionTaskEntry } from '../types/session'

/**
 * Clones only the still-pending entries from a finished/discarded session
 * (fresh ids, `carriedFromSessionId` set) so they can be re-offered later.
 * Completed and skipped entries never carry forward.
 */
export function buildCarryForwardEntries(session: Session): SessionTaskEntry[] {
  return session.taskEntries
    .filter((e) => e.status === 'pending')
    .map((e) => ({
      ...e,
      id: newId(),
      status: 'pending',
      carriedFromSessionId: session.id,
      completedAt: undefined,
    }))
}

/**
 * Appends carried-forward entries to a project's cumulative task list.
 * Already-completed project tasks are left untouched.
 */
export function attachCarryForwardToProject(project: Project, entries: SessionTaskEntry[]): Project {
  if (entries.length === 0) return project
  const tagged = entries.map((e) => ({ ...e, carriedFromProjectId: project.id }))
  const startOrder = project.taskEntries.length
    ? Math.max(...project.taskEntries.map((e) => e.order)) + 1
    : 0
  const ordered = tagged.map((e, i) => ({ ...e, order: startOrder + i }))
  return {
    ...project,
    taskEntries: [...project.taskEntries, ...ordered],
    updatedAt: new Date().toISOString(),
  }
}
