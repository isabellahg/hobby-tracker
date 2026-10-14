import { newId } from '../../types/common'
import type { PlanBucket, PlanBucketTaskRef } from '../../types/planBucket'
import { planBucketRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type {
  bucketCreateSchema,
  bucketIdSchema,
  bucketRenameSchema,
  bucketReorderTasksSchema,
  bucketTaskSchema,
} from '../validate/planBucket'
import type { z } from 'zod'

function buildTaskRefs(taskDefIds: string[]): PlanBucketTaskRef[] {
  return taskDefIds.map((taskDefId, order) => ({ id: newId(), taskDefId, order }))
}

async function requireBucket(id: string): Promise<PlanBucket> {
  const bucket = await planBucketRepo.getById(id)
  if (!bucket) throw new Error(`Plan bucket ${id} not found`)
  return bucket
}

export async function handleBucketCreate(
  payload: z.infer<typeof bucketCreateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const now = ctx.now.toISOString()
  const bucket: PlanBucket = {
    id: newId(),
    name: payload.name,
    taskRefs: buildTaskRefs(payload.taskDefIds),
    createdAt: now,
    updatedAt: now,
  }
  await planBucketRepo.put(bucket)
  return {
    changes: [{ store: 'planBuckets', id: bucket.id, changeType: 'created', after: bucket }],
    summary: `Create planning bucket "${bucket.name}" (${bucket.taskRefs.length} task(s))`,
  }
}

export async function handleBucketRename(
  payload: z.infer<typeof bucketRenameSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireBucket(payload.id)
  const updated: PlanBucket = { ...existing, name: payload.name, updatedAt: ctx.now.toISOString() }
  await planBucketRepo.put(updated)
  return {
    changes: [{ store: 'planBuckets', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Rename planning bucket to "${updated.name}"`,
  }
}

export async function handleBucketDelete(
  payload: z.infer<typeof bucketIdSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireBucket(payload.id)
  await planBucketRepo.remove(payload.id)
  return {
    changes: [{ store: 'planBuckets', id: payload.id, changeType: 'deleted', before: existing }],
    summary: `Delete planning bucket "${existing.name}"`,
  }
}

export async function handleBucketAddTask(
  payload: z.infer<typeof bucketTaskSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireBucket(payload.bucketId)
  if (existing.taskRefs.some((r) => r.taskDefId === payload.taskDefId)) {
    return {
      changes: [],
      summary: `Task already in "${existing.name}"`,
    }
  }
  const order = existing.taskRefs.length
    ? Math.max(...existing.taskRefs.map((r) => r.order)) + 1
    : 0
  const updated: PlanBucket = {
    ...existing,
    taskRefs: [...existing.taskRefs, { id: newId(), taskDefId: payload.taskDefId, order }],
    updatedAt: ctx.now.toISOString(),
  }
  await planBucketRepo.put(updated)
  return {
    changes: [{ store: 'planBuckets', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Add task to "${updated.name}"`,
  }
}

export async function handleBucketRemoveTask(
  payload: z.infer<typeof bucketTaskSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireBucket(payload.bucketId)
  const updated: PlanBucket = {
    ...existing,
    taskRefs: existing.taskRefs.filter((r) => r.taskDefId !== payload.taskDefId),
    updatedAt: ctx.now.toISOString(),
  }
  await planBucketRepo.put(updated)
  return {
    changes: [{ store: 'planBuckets', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Remove task from "${updated.name}"`,
  }
}

export async function handleBucketReorderTasks(
  payload: z.infer<typeof bucketReorderTasksSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireBucket(payload.bucketId)
  const orderIndex = new Map(payload.orderedTaskDefIds.map((id, index) => [id, index]))
  const updated: PlanBucket = {
    ...existing,
    taskRefs: existing.taskRefs
      .map((r) => ({ ...r, order: orderIndex.get(r.taskDefId) ?? r.order }))
      .sort((a, b) => a.order - b.order),
    updatedAt: ctx.now.toISOString(),
  }
  await planBucketRepo.put(updated)
  return {
    changes: [{ store: 'planBuckets', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Reorder tasks in "${updated.name}"`,
  }
}
