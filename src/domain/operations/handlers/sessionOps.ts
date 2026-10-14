import {
  addAdHocTask,
  discardSession,
  finishSession,
  pauseSession,
  resumeSession,
  reorderTasks,
  setTaskStatus,
  skipTask,
  startSession,
  toggleTask,
} from '../../logic/sessionLifecycle'
import { attachCarryForwardToProject, buildCarryForwardEntries } from '../../logic/carryForward'
import type { TaskDef } from '../../types/taskDef'
import {
  planBucketRepo,
  projectRepo,
  routineRepo,
  sessionRepo,
  taskDefRepo,
} from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type {
  sessionAddAdHocTaskSchema,
  sessionEntryIdSchema,
  sessionFinishSchema,
  sessionIdSchema,
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

export async function handleSessionStart(
  payload: z.infer<typeof sessionStartSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const routine = payload.routineId ? await routineRepo.getById(payload.routineId) : undefined
  if (payload.routineId && !routine) {
    throw new Error(`Routine ${payload.routineId} not found`)
  }
  const taskDefIds = routine ? routine.taskRefs.map((r) => r.taskDefId) : []
  const taskDefs = await taskDefRepo.getByIds(taskDefIds)
  const taskDefsById = new Map(taskDefs.map((d) => [d.id, d]))
  const startedAt = resolveWhen(payload.occurredAt, ctx.now)

  const session = startSession({ routine, taskDefsById, projectId: payload.projectId, now: startedAt })
  await sessionRepo.put(session)
  return {
    changes: [{ store: 'sessions', id: session.id, changeType: 'created', after: session }],
    summary: routine ? `Start session from routine "${routine.name}"` : 'Start a flexible session',
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
  const { session: finished, unfinishedEntries } = finishSession(existing, finishedAt)
  const changes: ChangedRecord[] = [
    { store: 'sessions', id: finished.id, changeType: 'updated', before: existing, after: finished },
  ]

  await sessionRepo.put(finished)

  if (finished.projectId && unfinishedEntries.length > 0) {
    const project = await projectRepo.getById(finished.projectId)
    if (project) {
      const carried = buildCarryForwardEntries(finished)
      const updatedProject = attachCarryForwardToProject(project, carried)
      await projectRepo.put(updatedProject)
      changes.push({
        store: 'projects',
        id: updatedProject.id,
        changeType: 'updated',
        before: project,
        after: updatedProject,
      })
    }
  }

  const completedCount = finished.taskEntries.filter((e) => e.status === 'completed').length
  return {
    changes,
    summary: `Finish session — ${completedCount}/${finished.taskEntries.length} tasks completed, ${finished.durationSec ?? 0}s`,
  }
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
 * Turns a Home planning bucket into a real session: seeds the checklist
 * from the bucket's ordered tasks, archives any one-off (non-recurring)
 * task used so it doesn't linger in the backlog, leaves recurring tasks
 * untouched so they naturally fall back into the (unfiltered) backlog once
 * the bucket itself is gone, and deletes the now-spent bucket.
 */
export async function handleSessionStartFromBucket(
  payload: z.infer<typeof sessionStartFromBucketSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const bucket = await planBucketRepo.getById(payload.bucketId)
  if (!bucket) throw new Error(`Plan bucket ${payload.bucketId} not found`)

  const orderedTaskDefIds = [...bucket.taskRefs].sort((a, b) => a.order - b.order).map((r) => r.taskDefId)
  const taskDefs = await taskDefRepo.getByIds(orderedTaskDefIds)
  const taskDefsById = new Map(taskDefs.map((d) => [d.id, d]))
  const startedAt = resolveWhen(payload.occurredAt, ctx.now)

  const session = startSession({
    taskDefsById,
    adHocTaskDefIds: orderedTaskDefIds,
    now: startedAt,
  })
  await sessionRepo.put(session)
  const changes: ChangedRecord[] = [
    { store: 'sessions', id: session.id, changeType: 'created', after: session },
  ]

  for (const taskDef of taskDefs) {
    if (taskDef.isRecurring) continue
    const archived: TaskDef = { ...taskDef, archived: true, updatedAt: ctx.now.toISOString() }
    await taskDefRepo.put(archived)
    changes.push({ store: 'taskDefs', id: archived.id, changeType: 'updated', before: taskDef, after: archived })
  }

  await planBucketRepo.remove(bucket.id)
  changes.push({ store: 'planBuckets', id: bucket.id, changeType: 'deleted', before: bucket })

  return {
    changes,
    summary: `Start session from "${bucket.name}" (${session.taskEntries.length} task(s))`,
  }
}
