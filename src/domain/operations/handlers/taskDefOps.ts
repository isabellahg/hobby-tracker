import { newId } from '../../types/common'
import type { TaskDef } from '../../types/taskDef'
import { taskDefRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type { taskDefArchiveSchema, taskDefCreateSchema, taskDefUpdateSchema } from '../validate/taskDef'
import type { z } from 'zod'

export async function handleTaskDefCreate(
  payload: z.infer<typeof taskDefCreateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const now = ctx.now.toISOString()
  const taskDef: TaskDef = {
    id: newId(),
    label: payload.label,
    description: payload.description,
    hobbyIds: payload.hobbyIds,
    skillIds: payload.skillIds,
    isRecurring: payload.isRecurring,
    defaultEstimateMin: payload.defaultEstimateMin,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  await taskDefRepo.put(taskDef)
  return {
    changes: [{ store: 'taskDefs', id: taskDef.id, changeType: 'created', after: taskDef }],
    summary: `Create task "${taskDef.label}"${taskDef.isRecurring ? ' (recurring)' : ''}`,
  }
}

export async function handleTaskDefUpdate(
  payload: z.infer<typeof taskDefUpdateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await taskDefRepo.getById(payload.id)
  if (!existing) throw new Error(`Task ${payload.id} not found`)
  const updated: TaskDef = {
    ...existing,
    label: payload.label ?? existing.label,
    description: payload.description ?? existing.description,
    hobbyIds: payload.hobbyIds ?? existing.hobbyIds,
    skillIds: payload.skillIds ?? existing.skillIds,
    isRecurring: payload.isRecurring ?? existing.isRecurring,
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
  const updated: TaskDef = { ...existing, archived: payload.archived, updatedAt: ctx.now.toISOString() }
  await taskDefRepo.put(updated)
  return {
    changes: [{ store: 'taskDefs', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `${payload.archived ? 'Archive' : 'Unarchive'} task "${updated.label}"`,
  }
}
