import { newId } from '../types/common'
import type { ID, ISODateTimeString } from '../types/common'
import type { Routine } from '../types/routine'
import type { PausedInterval, Session, SessionTaskEntry, SessionTaskStatus } from '../types/session'
import type { TaskDef } from '../types/taskDef'
import { toISODate } from './weekUtils'

export interface StartSessionParams {
  routine?: Routine
  taskDefsById: Map<ID, TaskDef>
  /** Ordered taskDefIds to seed from when there's no routine — e.g. starting a session from a plan bucket. */
  adHocTaskDefIds?: ID[]
  name?: string
  now: Date
}

export function startSession(params: StartSessionParams): Session {
  const { routine, taskDefsById, adHocTaskDefIds, name, now } = params
  const nowISOTime: ISODateTimeString = now.toISOString()

  const sourceTaskDefIds = routine
    ? [...routine.taskRefs].sort((a, b) => a.order - b.order).map((ref) => ref.taskDefId)
    : (adHocTaskDefIds ?? [])

  const taskEntries: SessionTaskEntry[] = sourceTaskDefIds.map((taskDefId, index) => {
    const def = taskDefsById.get(taskDefId)
    return {
      id: newId(),
      taskDefId,
      label: def?.label ?? '(unknown task)',
      hobbyIds: def?.hobbyIds ?? [],
      skillIds: def?.skillIds ?? [],
      status: 'pending',
      order: index,
      isAdHoc: false,
    }
  })
  // Nest a subtask under its parent's entry when both made it into the session.
  const entryIdByTaskDefId = new Map(taskEntries.map((e) => [e.taskDefId, e.id]))
  for (const entry of taskEntries) {
    const parentId = taskDefsById.get(entry.taskDefId!)?.parentId
    const parentEntryId = parentId ? entryIdByTaskDefId.get(parentId) : undefined
    if (parentEntryId) entry.parentEntryId = parentEntryId
  }

  const hobbyIds = Array.from(
    new Set([...(routine?.hobbyIds ?? []), ...taskEntries.flatMap((t) => t.hobbyIds)]),
  )
  const skillIds = Array.from(
    new Set([...(routine?.skillIds ?? []), ...taskEntries.flatMap((t) => t.skillIds)]),
  )

  return {
    id: newId(),
    name,
    routineId: routine?.id,
    hobbyIds,
    skillIds,
    taskEntries,
    startedAt: nowISOTime,
    pausedIntervals: [],
    state: 'in_progress',
    dateKey: toISODate(now),
  }
}

function updateEntry(session: Session, entryId: ID, patch: Partial<SessionTaskEntry>): Session {
  return {
    ...session,
    taskEntries: session.taskEntries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
  }
}

/**
 * Toggles an entry, then keeps its ancestors consistent: a parent completes
 * itself once all of its non-skipped subtasks are done, and drops back to
 * pending when one of them is unchecked.
 */
export function toggleTask(session: Session, entryId: ID, now: Date = new Date()): Session {
  const entry = session.taskEntries.find((e) => e.id === entryId)
  if (!entry) return session
  let next =
    entry.status === 'completed'
      ? updateEntry(session, entryId, { status: 'pending', completedAt: undefined })
      : updateEntry(session, entryId, { status: 'completed', completedAt: now.toISOString() })

  let parentId = entry.parentEntryId
  const seen = new Set<ID>([entryId])
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = next.taskEntries.find((e) => e.id === parentId)
    if (!parent || parent.status === 'skipped') break
    const children = next.taskEntries.filter((e) => e.parentEntryId === parentId && e.status !== 'skipped')
    const allDone = children.length > 0 && children.every((e) => e.status === 'completed')
    if (allDone && parent.status === 'pending') {
      next = updateEntry(next, parent.id, { status: 'completed', completedAt: now.toISOString() })
    } else if (!allDone && parent.status === 'completed') {
      next = updateEntry(next, parent.id, { status: 'pending', completedAt: undefined })
    } else break
    parentId = parent.parentEntryId
  }
  return next
}

export function skipTask(session: Session, entryId: ID): Session {
  return updateEntry(session, entryId, { status: 'skipped' })
}

/** Renames this session's snapshot of a task; the library task is untouched. */
export function renameTask(session: Session, entryId: ID, label: string): Session {
  return updateEntry(session, entryId, { label })
}

/** Sets a task entry to an explicit status, rather than toggling between two. */
export function setTaskStatus(
  session: Session,
  entryId: ID,
  status: SessionTaskStatus,
  now: Date = new Date(),
): Session {
  return updateEntry(session, entryId, {
    status,
    completedAt: status === 'completed' ? now.toISOString() : undefined,
  })
}

export function addAdHocTask(
  session: Session,
  label: string,
  hobbyIds: ID[] = [],
  skillIds: ID[] = [],
): Session {
  const order = session.taskEntries.length
    ? Math.max(...session.taskEntries.map((e) => e.order)) + 1
    : 0
  const entry: SessionTaskEntry = {
    id: newId(),
    label,
    hobbyIds,
    skillIds,
    status: 'pending',
    order,
    isAdHoc: true,
  }
  return {
    ...session,
    taskEntries: [...session.taskEntries, entry],
    hobbyIds: Array.from(new Set([...session.hobbyIds, ...hobbyIds])),
    skillIds: Array.from(new Set([...session.skillIds, ...skillIds])),
  }
}

/**
 * Adds a subtask entry under `parentEntryId`. When the parent came from the
 * library, `taskDef` is the freshly created child task it links to.
 */
export function addSubtaskEntry(session: Session, parentEntryId: ID, label: string, taskDef?: TaskDef): Session {
  const parent = session.taskEntries.find((e) => e.id === parentEntryId)
  if (!parent) throw new Error(`Task entry ${parentEntryId} not found`)
  const order = Math.max(...session.taskEntries.map((e) => e.order)) + 1
  const entry: SessionTaskEntry = {
    id: newId(),
    taskDefId: taskDef?.id,
    label,
    hobbyIds: taskDef?.hobbyIds ?? parent.hobbyIds,
    skillIds: taskDef?.skillIds ?? parent.skillIds,
    status: 'pending',
    order,
    isAdHoc: !taskDef,
    parentEntryId,
  }
  // A new open subtask means a completed parent isn't done anymore.
  const reopened =
    parent.status === 'completed'
      ? updateEntry(session, parent.id, { status: 'pending', completedAt: undefined })
      : session
  return { ...reopened, taskEntries: [...reopened.taskEntries, entry] }
}

export function reorderTasks(session: Session, orderedEntryIds: ID[]): Session {
  const orderIndex = new Map(orderedEntryIds.map((id, index) => [id, index]))
  return {
    ...session,
    taskEntries: session.taskEntries
      .map((e) => ({ ...e, order: orderIndex.get(e.id) ?? e.order }))
      .sort((a, b) => a.order - b.order),
  }
}

export function pauseSession(session: Session, now: Date = new Date()): Session {
  if (session.state !== 'in_progress') return session
  const isAlreadyPaused = session.pausedIntervals.some((p) => !p.resumedAt)
  if (isAlreadyPaused) return session
  const interval: PausedInterval = { pausedAt: now.toISOString() }
  return { ...session, pausedIntervals: [...session.pausedIntervals, interval] }
}

export function resumeSession(session: Session, now: Date = new Date()): Session {
  const openIndex = session.pausedIntervals.findIndex((p) => !p.resumedAt)
  if (openIndex === -1) return session
  const pausedIntervals = session.pausedIntervals.map((p, i) =>
    i === openIndex ? { ...p, resumedAt: now.toISOString() } : p,
  )
  return { ...session, pausedIntervals }
}

export function totalPausedMs(session: Session, now: Date): number {
  return session.pausedIntervals.reduce((sum, p) => {
    const start = new Date(p.pausedAt).getTime()
    const end = p.resumedAt ? new Date(p.resumedAt).getTime() : now.getTime()
    return sum + Math.max(0, end - start)
  }, 0)
}

export interface FinishSessionResult {
  session: Session
  unfinishedEntries: SessionTaskEntry[]
}

/**
 * Marks the session finished. "Finished" and "every task completed" are
 * intentionally independent facts: a session can finish with pending
 * entries still present.
 */
export function finishSession(session: Session, now: Date = new Date()): FinishSessionResult {
  const resumed = resumeSession(session, now)
  const elapsedMs = now.getTime() - new Date(resumed.startedAt).getTime()
  const pausedMs = totalPausedMs(resumed, now)
  const durationSec = Math.max(0, Math.round((elapsedMs - pausedMs) / 1000))

  const finished: Session = {
    ...resumed,
    state: 'finished',
    finishedAt: now.toISOString(),
    durationSec,
  }
  const unfinishedEntries = finished.taskEntries.filter((e) => e.status === 'pending')
  return { session: finished, unfinishedEntries }
}

export function discardSession(session: Session, now: Date = new Date()): Session {
  return { ...session, state: 'discarded', discardedAt: now.toISOString() }
}
