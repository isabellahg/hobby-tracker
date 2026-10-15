import { newId } from '../../types/common'
import type { TaskDef } from '../../types/taskDef'
import type { PersonalRecord } from '../../types/record'
import { toISODate } from '../../logic/weekUtils'
import { descendantsOf, wouldCreateCycle } from '../../logic/taskTree'
import { recordRepo, taskDefRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type {
  taskDefArchiveSchema,
  taskDefCreateSchema,
  taskDefFinishSchema,
  taskDefUpdateSchema,
} from '../validate/taskDef'
import type { z } from 'zod'

const KIND_LABEL: Record<TaskDef['kind'], string> = {
  once: 'one-off',
  recurring: 'recurring',
  ongoing: 'ongoing',
}

async function requireOpenParent(parentId: string): Promise<TaskDef> {
  const parent = await taskDefRepo.getById(parentId)
  if (!parent) throw new Error(`Parent task ${parentId} not found`)
  if (parent.archived) throw new Error(`"${parent.label}" is archived; restore it before adding subtasks`)
  return parent
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
  const taskDef: TaskDef = {
    id: newId(),
    label: payload.label,
    description: payload.description,
    hobbyIds: payload.hobbyIds ?? parent?.hobbyIds ?? [],
    skillIds: payload.skillIds ?? parent?.skillIds ?? [],
    kind: payload.kind,
    parentId: parent?.id,
    nextAction: payload.nextAction,
    defaultEstimateMin: payload.defaultEstimateMin,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
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
  const updated: TaskDef = {
    ...existing,
    parentId,
    label: payload.label ?? existing.label,
    description: payload.description ?? existing.description,
    hobbyIds: payload.hobbyIds ?? existing.hobbyIds,
    skillIds: payload.skillIds ?? existing.skillIds,
    kind: payload.kind ?? existing.kind,
    nextAction: payload.nextAction ?? existing.nextAction,
    defaultEstimateMin: payload.defaultEstimateMin ?? existing.defaultEstimateMin,
    updatedAt: ctx.now.toISOString(),
  }
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
  const record: PersonalRecord = {
    id: newId(),
    hobbyId: existing.hobbyIds[0],
    skillId: existing.skillIds[0],
    date: payload.date ?? toISODate(ctx.now),
    description: `Finished "${existing.label}"`,
    taskDefId: existing.id,
    createdAt: now,
  }
  const taskChanges = await archiveTaskTree(existing, ctx.now)
  await recordRepo.put(record)
  return {
    changes: [...taskChanges, { store: 'personalRecords', id: record.id, changeType: 'created', after: record }],
    summary: `Finish "${existing.label}" and record it as a milestone`,
  }
}
