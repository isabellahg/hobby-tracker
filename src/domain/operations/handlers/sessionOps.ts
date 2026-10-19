import {
  addAdHocTask,
  addLibraryTasks,
  addSubtaskEntry,
  discardSession,
  finishSession,
  logCompletedTask,
  pauseSession,
  resumeSession,
  renameTask,
  reorderTasks,
  setTaskStatus,
  skipTask,
  startSession,
  toggleTask,
} from '../../logic/sessionLifecycle'
import { newId } from '../../types/common'
import type { Session } from '../../types/session'
import type { TaskDef } from '../../types/taskDef'
import { descendantsOf } from '../../logic/taskTree'
import { archiveTaskTree } from './taskDefOps'
import { planBucketRepo, routineRepo, sessionRepo, taskDefRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type {
  sessionAddAdHocTaskSchema,
  sessionAddSubtaskSchema,
  sessionAddTaskSchema,
  sessionLogCompletedTaskSchema,
  sessionSetTagsSchema,
  sessionEntryIdSchema,
  sessionFinishSchema,
  sessionIdSchema,
  sessionRenameSchema,
  sessionRenameTaskSchema,
  sessionReorderTasksSchema,
  sessionSetTaskStatusSchema,
  sessionStartFromBucketSchema,
  sessionStartSchema,
} from '../validate/session'
import type { z } from 'zod'

async function requireSession(sessionId: string) {
  const session = await sessionRepo.getById(sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)
  return session
}

/** Parses an optional ISO override, falling back to the context's "now". */
function resolveWhen(override: string | undefined, fallback: Date): Date {
  if (!override) return fallback
  const parsed = new Date(override)
  if (Number.isNaN(parsed.getTime())) throw new Error(`"${override}" is not a valid date/time`)
  return parsed
}

/** Each id followed by its open subtasks, deduplicated, order preserved. */
function withOpenSubtasks(allTaskDefs: TaskDef[], ids: string[]): string[] {
  const out: string[] = []
  for (const id of ids) {
    const subtree = [id, ...descendantsOf(allTaskDefs, id).filter((t) => !t.archived).map((t) => t.id)]
    for (const x of subtree) if (!out.includes(x)) out.push(x)
  }
  return out
}

/**
 * Starts a session from a routine (its own tasks, then any next-run extras
 * with their open subtasks — the extras are then cleared) or a blank
 * flexible session.
 */
export async function handleSessionStart(
  payload: z.infer<typeof sessionStartSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const routine = payload.routineId ? await routineRepo.getById(payload.routineId) : undefined
  if (payload.routineId && !routine) {
    throw new Error(`Routine ${payload.routineId} not found`)
  }
  const allTaskDefs = await taskDefRepo.getAll()
  const taskDefsById = new Map(allTaskDefs.map((d) => [d.id, d]))
  const ownIds = routine ? [...routine.taskRefs].sort((a, b) => a.order - b.order).map((r) => r.taskDefId) : []
  const extras = routine?.extraTaskRefs ?? []
  const extraIds = withOpenSubtasks(
    allTaskDefs,
    [...extras].sort((a, b) => a.order - b.order).map((r) => r.taskDefId),
  )
  const orderedIds = [...ownIds, ...extraIds.filter((id) => !ownIds.includes(id))]
  const startedAt = resolveWhen(payload.occurredAt, ctx.now)

  const session = startSession({ routine, taskDefsById, adHocTaskDefIds: orderedIds, now: startedAt })
  await sessionRepo.put(session)
  const changes: ChangedRecord[] = [{ store: 'sessions', id: session.id, changeType: 'created', after: session }]

  if (routine && extras.length > 0) {
    const cleared = { ...routine, extraTaskRefs: [], updatedAt: ctx.now.toISOString() }
    await routineRepo.put(cleared)
    changes.push({ store: 'routines', id: routine.id, changeType: 'updated', before: routine, after: cleared })
  }
  return {
    changes,
    summary: routine ? `Start session from routine "${routine.name}"` : 'Start a flexible session',
  }
}

export async function handleSessionAddTask(
  payload: z.infer<typeof sessionAddTaskSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  if (existing.state !== 'in_progress') throw new Error('Tasks can only be added to a session in progress')
  const allTaskDefs = await taskDefRepo.getAll()
  const task = allTaskDefs.find((t) => t.id === payload.taskDefId)
  if (!task || task.archived) throw new Error(`Task ${payload.taskDefId} not found`)
  const updated = addLibraryTasks(
    existing,
    withOpenSubtasks(allTaskDefs, [task.id]),
    new Map(allTaskDefs.map((d) => [d.id, d])),
  )
  if (updated === existing) return { changes: [], summary: `"${task.label}" is already in this session` }
  await sessionRepo.put(updated)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Add "${task.label}" to the session`,
  }
}

export async function handleSessionSetTags(
  payload: z.infer<typeof sessionSetTagsSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const updated = { ...existing, hobbyIds: payload.hobbyIds, skillIds: payload.skillIds }
  await sessionRepo.put(updated)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Tag session with ${payload.hobbyIds.length} hobby and ${payload.skillIds.length} skill tag(s)`,
  }
}

export async function handleSessionToggleTask(
  payload: z.infer<typeof sessionEntryIdSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const updated = toggleTask(existing, payload.entryId, ctx.now)
  await sessionRepo.put(updated)
  const entry = updated.taskEntries.find((e) => e.id === payload.entryId)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Mark task "${entry?.label}" as ${entry?.status}`,
  }
}

export async function handleSessionSkipTask(
  payload: z.infer<typeof sessionEntryIdSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const updated = skipTask(existing, payload.entryId)
  await sessionRepo.put(updated)
  const entry = updated.taskEntries.find((e) => e.id === payload.entryId)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Skip task "${entry?.label}"`,
  }
}

export async function handleSessionSetTaskStatus(
  payload: z.infer<typeof sessionSetTaskStatusSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const entry = existing.taskEntries.find((e) => e.label === payload.label)
  if (!entry) throw new Error(`No task labeled "${payload.label}" in this session`)
  const updated = setTaskStatus(existing, entry.id, payload.status, ctx.now)
  await sessionRepo.put(updated)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Mark task "${payload.label}" as ${payload.status}`,
  }
}

export async function handleSessionAddAdHocTask(
  payload: z.infer<typeof sessionAddAdHocTaskSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const updated = addAdHocTask(existing, payload.label, payload.hobbyIds, payload.skillIds)
  await sessionRepo.put(updated)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Add ad-hoc task "${payload.label}" to the session`,
  }
}

export async function handleSessionReorderTasks(
  payload: z.infer<typeof sessionReorderTasksSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const updated = reorderTasks(existing, payload.orderedEntryIds)
  await sessionRepo.put(updated)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: 'Reorder session tasks',
  }
}

export async function handleSessionPause(
  payload: z.infer<typeof sessionIdSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const updated = pauseSession(existing, ctx.now)
  await sessionRepo.put(updated)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: 'Pause session',
  }
}

export async function handleSessionResume(
  payload: z.infer<typeof sessionIdSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const updated = resumeSession(existing, ctx.now)
  await sessionRepo.put(updated)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: 'Resume session',
  }
}

export async function handleSessionFinish(
  payload: z.infer<typeof sessionFinishSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const finishedAt = resolveWhen(payload.finishedAt, ctx.now)
  const { session: finished } = finishSession(existing, finishedAt)
  const changes: ChangedRecord[] = [
    { store: 'sessions', id: finished.id, changeType: 'updated', before: existing, after: finished },
  ]

  await sessionRepo.put(finished)
  const completedTaskDefIds = finished.taskEntries
    .filter((e) => e.status === 'completed' && e.taskDefId)
    .map((e) => e.taskDefId!)
  changes.push(...(await closeCompletedOneOffs(finished, completedTaskDefIds, ctx.now)))

  const completedCount = finished.taskEntries.filter((e) => e.status === 'completed').length
  return {
    changes,
    summary: `Finish session — ${completedCount}/${finished.taskEntries.length} tasks completed, ${finished.durationSec ?? 0}s`,
  }
}

/**
 * One-off tasks leave the backlog once actually completed in a finished
 * session. A routine's own tasks (and their subtasks) are template members
 * meant to repeat, so they stay — but a task only added for this run of the
 * routine is fair game.
 */
async function closeCompletedOneOffs(session: Session, completedTaskDefIds: string[], now: Date): Promise<ChangedRecord[]> {
  const routine = session.routineId ? await routineRepo.getById(session.routineId) : undefined
  const allTaskDefs = routine ? await taskDefRepo.getAll() : []
  const routineMemberIds = new Set(
    (routine?.taskRefs ?? []).flatMap((r) => [r.taskDefId, ...descendantsOf(allTaskDefs, r.taskDefId).map((t) => t.id)]),
  )
  const changes: ChangedRecord[] = []
  const taskDefs = await taskDefRepo.getByIds(completedTaskDefIds.filter((id) => !routineMemberIds.has(id)))
  for (const taskDef of taskDefs) {
    if (taskDef.kind !== 'once') continue
    // Re-read: an earlier parent in this loop may already have closed it.
    const current = await taskDefRepo.getById(taskDef.id)
    if (!current || current.archived) continue
    changes.push(...(await archiveTaskTree(current, now)))
  }
  return changes
}

/**
 * "I did this but forgot to add it": puts a backlog task into a session as
 * completed. On a finished session it's stamped at the session's end, and a
 * one-off then leaves the backlog just as if it had been ticked in time.
 */
export async function handleSessionLogCompletedTask(
  payload: z.infer<typeof sessionLogCompletedTaskSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  if (existing.state === 'discarded') throw new Error('Tasks cannot be logged on a discarded session')
  const allTaskDefs = await taskDefRepo.getAll()
  const task = allTaskDefs.find((t) => t.id === payload.taskDefId)
  if (!task || task.archived) throw new Error(`Task ${payload.taskDefId} not found`)

  const when = existing.finishedAt ? new Date(existing.finishedAt) : ctx.now
  const updated = logCompletedTask(existing, task.id, new Map(allTaskDefs.map((d) => [d.id, d])), when)
  if (updated === existing) return { changes: [], summary: `"${task.label}" was already completed in this session` }
  await sessionRepo.put(updated)

  const changes: ChangedRecord[] = [
    { store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated },
  ]
  if (updated.state === 'finished') {
    // The task itself, plus any parent that completed because of it.
    const wasDone = new Set(existing.taskEntries.filter((e) => e.status === 'completed').map((e) => e.id))
    const newlyDone = updated.taskEntries
      .filter((e) => e.status === 'completed' && !wasDone.has(e.id) && e.taskDefId)
      .map((e) => e.taskDefId!)
    changes.push(...(await closeCompletedOneOffs(updated, newlyDone, ctx.now)))
  }
  return { changes, summary: `Log "${task.label}" as completed in the session` }
}

export async function handleSessionDiscard(
  payload: z.infer<typeof sessionIdSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const updated = discardSession(existing, ctx.now)
  await sessionRepo.put(updated)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: 'Discard session (does not count as activity)',
  }
}

/**
 * Turns a Home planning bucket into a real session named after it, seeded
 * from the bucket's ordered tasks, and deletes the now-spent bucket. Tasks
 * themselves are untouched here — one-offs only leave the backlog when
 * completed (see handleSessionFinish).
 */
export async function handleSessionStartFromBucket(
  payload: z.infer<typeof sessionStartFromBucketSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const bucket = await planBucketRepo.getById(payload.bucketId)
  if (!bucket) throw new Error(`Plan bucket ${payload.bucketId} not found`)

  // A bucketed task brings its open subtasks along, right after it.
  const allTaskDefs = await taskDefRepo.getAll()
  const taskDefsById = new Map(allTaskDefs.map((d) => [d.id, d]))
  const orderedTaskDefIds = withOpenSubtasks(
    allTaskDefs,
    [...bucket.taskRefs].sort((a, b) => a.order - b.order).map((r) => r.taskDefId),
  )
  const startedAt = resolveWhen(payload.occurredAt, ctx.now)

  const session = startSession({
    taskDefsById,
    adHocTaskDefIds: orderedTaskDefIds,
    name: bucket.name,
    now: startedAt,
  })
  await sessionRepo.put(session)
  const changes: ChangedRecord[] = [
    { store: 'sessions', id: session.id, changeType: 'created', after: session },
  ]

  await planBucketRepo.remove(bucket.id)
  changes.push({ store: 'planBuckets', id: bucket.id, changeType: 'deleted', before: bucket })

  return {
    changes,
    summary: `Start session from "${bucket.name}" (${session.taskEntries.length} task(s))`,
  }
}

export async function handleSessionRename(
  payload: z.infer<typeof sessionRenameSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const updated = { ...existing, name: payload.name }
  await sessionRepo.put(updated)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Rename session to "${payload.name}"`,
  }
}

export async function handleSessionRenameTask(
  payload: z.infer<typeof sessionRenameTaskSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  if (!existing.taskEntries.some((e) => e.id === payload.entryId)) {
    throw new Error(`Task entry ${payload.entryId} not found in this session`)
  }
  const updated = renameTask(existing, payload.entryId, payload.label)
  await sessionRepo.put(updated)
  return {
    changes: [{ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Rename session task to "${payload.label}"`,
  }
}

/**
 * Permanently removes a finished or discarded session. Marks and streaks are
 * derived from sessions, so they recompute on their own.
 */
export async function handleSessionDelete(
  payload: z.infer<typeof sessionIdSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  if (existing.state === 'in_progress') {
    throw new Error('A session in progress can only be discarded, not deleted')
  }
  await sessionRepo.remove(existing.id)
  return {
    changes: [{ store: 'sessions', id: existing.id, changeType: 'deleted', before: existing }],
    summary: `Delete session from ${existing.dateKey}`,
  }
}

/**
 * Splits a task mid-session. If the parent entry came from the library the
 * subtask becomes a real child task too, so it outlives the session.
 */
export async function handleSessionAddSubtask(
  payload: z.infer<typeof sessionAddSubtaskSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireSession(payload.sessionId)
  const parentEntry = existing.taskEntries.find((e) => e.id === payload.parentEntryId)
  if (!parentEntry) throw new Error(`Task entry ${payload.parentEntryId} not found`)
  const changes: ChangedRecord[] = []

  const parentDef = parentEntry.taskDefId ? await taskDefRepo.getById(parentEntry.taskDefId) : undefined
  let child: TaskDef | undefined
  if (parentDef && !parentDef.archived) {
    const now = ctx.now.toISOString()
    child = {
      id: newId(),
      label: payload.label,
      hobbyIds: parentDef.hobbyIds,
      skillIds: parentDef.skillIds,
      kind: 'once',
      parentId: parentDef.id,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    await taskDefRepo.put(child)
    changes.push({ store: 'taskDefs', id: child.id, changeType: 'created', after: child })
  }

  const updated = addSubtaskEntry(existing, parentEntry.id, payload.label, child)
  await sessionRepo.put(updated)
  changes.unshift({ store: 'sessions', id: updated.id, changeType: 'updated', before: existing, after: updated })
  return { changes, summary: `Add subtask "${payload.label}" to "${parentEntry.label}"` }
}
