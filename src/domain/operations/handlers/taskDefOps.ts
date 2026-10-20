import { newId } from '../../types/common'
import type { ItemStatus, TaskDef } from '../../types/taskDef'
import type { PersonalRecord } from '../../types/record'
import { toISODate } from '../../logic/weekUtils'
import { descendantsOf, wouldCreateCycle } from '../../logic/taskTree'
import { DEFAULT_HABIT, normalizeFrequency } from '../../logic/habits'
import { statusLabel } from '../../logic/listItems'
import { requireList } from './listOps'
import { recordRepo, taskDefRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type {
  taskDefArchiveSchema,
  taskDefCreateSchema,
  taskDefFinishSchema,
  taskDefMoveToSchema,
  taskDefSetStatusSchema,
  taskDefUpdateSchema,
} from '../validate/taskDef'
import type { z } from 'zod'

const KIND_LABEL: Record<TaskDef['kind'], string> = {
  once: 'one-off',
  recurring: 'habit',
  ongoing: 'ongoing',
}

async function requireOpenParent(parentId: string): Promise<TaskDef> {
  const parent = await taskDefRepo.getById(parentId)
  if (!parent) throw new Error(`Parent task ${parentId} not found`)
  if (parent.archived) throw new Error(`"${parent.label}" is archived; restore it before adding subtasks`)
  return parent
}

/** A habit always carries a status and a frequency, so it can be rated. */
function withHabitDefaults(task: TaskDef, now: string): TaskDef {
  if (task.kind !== 'recurring') return task
  return {
    ...task,
    status: task.status ?? 'ongoing',
    statusAt: task.statusAt ?? now,
    habit: normalizeFrequency(task.habit ?? DEFAULT_HABIT),
  }
}

function milestoneFor(task: TaskDef, date: string, now: string): PersonalRecord {
  return {
    id: newId(),
    hobbyId: task.hobbyIds[0],
    skillId: task.skillIds[0],
    date,
    description: `Finished "${task.label}"`,
    taskDefId: task.id,
    createdAt: now,
  }
}

function subtaskSuffix(count: number): string {
  return count > 0 ? ` and ${count} subtask${count === 1 ? '' : 's'}` : ''
}

/**
 * Archives a task together with every still-open subtask below it — closing a
 * parent closes its whole tree. Restoring is deliberately not cascaded.
 */
export async function archiveTaskTree(root: TaskDef, now: Date): Promise<ChangedRecord[]> {
  const all = await taskDefRepo.getAll()
  const targets = [root, ...descendantsOf(all, root.id)].filter((t) => !t.archived)
  const changes: ChangedRecord[] = []
  for (const task of targets) {
    const archived: TaskDef = { ...task, archived: true, updatedAt: now.toISOString() }
    await taskDefRepo.put(archived)
    changes.push({ store: 'taskDefs', id: archived.id, changeType: 'updated', before: task, after: archived })
  }
  return changes
}

export async function handleTaskDefCreate(
  payload: z.infer<typeof taskDefCreateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const now = ctx.now.toISOString()
  const parent = payload.parentId ? await requireOpenParent(payload.parentId) : undefined
  if (payload.listId) await requireList(payload.listId)
  const taskDef: TaskDef = withHabitDefaults({
    id: newId(),
    label: payload.label,
    description: payload.description,
    hobbyIds: payload.hobbyIds ?? parent?.hobbyIds ?? [],
    skillIds: payload.skillIds ?? parent?.skillIds ?? [],
    kind: payload.kind,
    parentId: parent?.id,
    nextAction: payload.nextAction,
    defaultEstimateMin: payload.defaultEstimateMin,
    listId: payload.listId,
    status: payload.status ?? (payload.listId ? 'want' : undefined),
    statusAt: payload.status || payload.listId ? now : undefined,
    inBacklog: payload.inBacklog,
    habit: payload.habit,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }, now)
  await taskDefRepo.put(taskDef)
  return {
    changes: [{ store: 'taskDefs', id: taskDef.id, changeType: 'created', after: taskDef }],
    summary: parent
      ? `Add subtask "${taskDef.label}" to "${parent.label}"`
      : `Create ${KIND_LABEL[taskDef.kind]} task "${taskDef.label}"`,
  }
}

export async function handleTaskDefUpdate(
  payload: z.infer<typeof taskDefUpdateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await taskDefRepo.getById(payload.id)
  if (!existing) throw new Error(`Task ${payload.id} not found`)
  let parentId = existing.parentId
  if (payload.parentId === null) parentId = undefined
  else if (payload.parentId !== undefined && payload.parentId !== existing.parentId) {
    await requireOpenParent(payload.parentId)
    if (wouldCreateCycle(await taskDefRepo.getAll(), existing.id, payload.parentId)) {
      throw new Error(`"${existing.label}" can't be a subtask of itself or of its own subtask`)
    }
    parentId = payload.parentId
  }
  const now = ctx.now.toISOString()
  const statusChanged = payload.status !== undefined && payload.status !== existing.status
  const updated: TaskDef = withHabitDefaults({
    ...existing,
    parentId,
    label: payload.label ?? existing.label,
    description: payload.description ?? existing.description,
    hobbyIds: payload.hobbyIds ?? existing.hobbyIds,
    skillIds: payload.skillIds ?? existing.skillIds,
    kind: payload.kind ?? existing.kind,
    nextAction: payload.nextAction ?? existing.nextAction,
    defaultEstimateMin: payload.defaultEstimateMin ?? existing.defaultEstimateMin,
    status: payload.status ?? existing.status,
    statusAt: statusChanged ? now : existing.statusAt,
    inBacklog: payload.inBacklog ?? existing.inBacklog,
    habit: payload.habit ? normalizeFrequency(payload.habit) : existing.habit,
    updatedAt: now,
  }, now)
  await taskDefRepo.put(updated)
  return {
    changes: [{ store: 'taskDefs', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Update task "${updated.label}"`,
  }
}

export async function handleTaskDefArchive(
  payload: z.infer<typeof taskDefArchiveSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await taskDefRepo.getById(payload.id)
  if (!existing) throw new Error(`Task ${payload.id} not found`)
  if (payload.archived) {
    const changes = await archiveTaskTree(existing, ctx.now)
    return { changes, summary: `Archive task "${existing.label}"${subtaskSuffix(changes.length - 1)}` }
  }
  const updated: TaskDef = { ...existing, archived: false, updatedAt: ctx.now.toISOString() }
  await taskDefRepo.put(updated)
  return {
    changes: [{ store: 'taskDefs', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Restore task "${updated.label}"`,
  }
}

/** Completes an ongoing task for good: archives it and records a milestone. */
export async function handleTaskDefFinish(
  payload: z.infer<typeof taskDefFinishSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await taskDefRepo.getById(payload.id)
  if (!existing) throw new Error(`Task ${payload.id} not found`)
  if (existing.kind !== 'ongoing') throw new Error(`"${existing.label}" is not an ongoing task`)
  if (existing.archived) throw new Error(`"${existing.label}" is already finished or archived`)

  const now = ctx.now.toISOString()
  const record = milestoneFor(existing, payload.date ?? toISODate(ctx.now), now)
  const taskChanges = await archiveTaskTree(existing, ctx.now)
  await recordRepo.put(record)
  return {
    changes: [...taskChanges, { store: 'personalRecords', id: record.id, changeType: 'created', after: record }],
    summary: `Finish "${existing.label}" and record it as a milestone`,
  }
}

/**
 * Moves a list item or habit between states. Marking a list item done records
 * a milestone, but it stays on its list (under Done) — lists are a history too.
 */
export async function handleTaskDefSetStatus(
  payload: z.infer<typeof taskDefSetStatusSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await taskDefRepo.getById(payload.id)
  if (!existing) throw new Error(`Task ${payload.id} not found`)
  const habit = existing.kind === 'recurring'
  if (!habit && !existing.listId) throw new Error(`"${existing.label}" is not on a list or a habit`)
  if (habit && payload.status === 'done') throw new Error('Habits are never done — pause or abandon them instead')
  const status: ItemStatus = payload.status
  if (existing.status === status) {
    return { changes: [], summary: `"${existing.label}" is already ${statusLabel(status, habit)}` }
  }

  const now = ctx.now.toISOString()
  const updated: TaskDef = { ...existing, status, statusAt: now, updatedAt: now }
  await taskDefRepo.put(updated)
  const changes: ChangedRecord[] = [
    { store: 'taskDefs', id: updated.id, changeType: 'updated', before: existing, after: updated },
  ]
  if (status === 'done') {
    const record = milestoneFor(existing, toISODate(ctx.now), now)
    await recordRepo.put(record)
    changes.push({ store: 'personalRecords', id: record.id, changeType: 'created', after: record })
  }
  return { changes, summary: `Mark "${existing.label}" ${statusLabel(status, habit)}` }
}

/** Converts a task into a habit, onto a list, or back to a plain backlog task. */
export async function handleTaskDefMoveTo(
  payload: z.infer<typeof taskDefMoveToSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await taskDefRepo.getById(payload.id)
  if (!existing) throw new Error(`Task ${payload.id} not found`)
  const now = ctx.now.toISOString()
  const plainKind = existing.kind === 'recurring' ? 'once' : existing.kind
  let updated: TaskDef
  let where: string
  if (payload.target === 'backlog') {
    updated = {
      ...existing,
      kind: plainKind,
      listId: undefined,
      status: undefined,
      statusAt: undefined,
      inBacklog: undefined,
      habit: undefined,
    }
    where = 'the backlog'
  } else if (payload.target === 'habits') {
    updated = withHabitDefaults(
      { ...existing, kind: 'recurring', listId: undefined, inBacklog: undefined, status: 'ongoing', statusAt: now },
      now,
    )
    where = 'Habits'
  } else {
    const list = await requireList(payload.target)
    const same = existing.listId === list.id
    updated = {
      ...existing,
      kind: plainKind,
      listId: list.id,
      status: same ? existing.status : 'want',
      statusAt: same ? existing.statusAt : now,
      habit: undefined,
    }
    where = `"${list.name}"`
  }
  updated = { ...updated, updatedAt: now }
  await taskDefRepo.put(updated)
  return {
    changes: [{ store: 'taskDefs', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Move "${existing.label}" to ${where}`,
  }
}
