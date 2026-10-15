import { newId } from '../../types/common'
import type { TaskDef } from '../../types/taskDef'
import type { PersonalRecord } from '../../types/record'
import { toISODate } from '../../logic/weekUtils'
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
    kind: payload.kind,
    nextAction: payload.nextAction,
    defaultEstimateMin: payload.defaultEstimateMin,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  await taskDefRepo.put(taskDef)
  return {
    changes: [{ store: 'taskDefs', id: taskDef.id, changeType: 'created', after: taskDef }],
    summary: `Create ${KIND_LABEL[taskDef.kind]} task "${taskDef.label}"`,
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
  const updated: TaskDef = { ...existing, archived: payload.archived, updatedAt: ctx.now.toISOString() }
  await taskDefRepo.put(updated)
  return {
    changes: [{ store: 'taskDefs', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `${payload.archived ? 'Archive' : 'Restore'} task "${updated.label}"`,
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
  const finished: TaskDef = { ...existing, archived: true, updatedAt: now }
  const record: PersonalRecord = {
    id: newId(),
    hobbyId: existing.hobbyIds[0],
    skillId: existing.skillIds[0],
    date: payload.date ?? toISODate(ctx.now),
    description: `Finished "${existing.label}"`,
    taskDefId: existing.id,
    createdAt: now,
  }
  await taskDefRepo.put(finished)
  await recordRepo.put(record)
  return {
    changes: [
      { store: 'taskDefs', id: finished.id, changeType: 'updated', before: existing, after: finished },
      { store: 'personalRecords', id: record.id, changeType: 'created', after: record },
    ],
    summary: `Finish "${existing.label}" and record it as a milestone`,
  }
}
