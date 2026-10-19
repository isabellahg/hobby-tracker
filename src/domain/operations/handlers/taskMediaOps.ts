import { newId } from '../../types/common'
import type { TaskMedia } from '../../types/taskMedia'
import { taskDefRepo, taskMediaRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type { taskAddMediaSchema, taskRemoveMediaSchema, taskUpdateMediaSchema } from '../validate/taskMedia'
import type { z } from 'zod'

export async function handleTaskAddMedia(
  payload: z.infer<typeof taskAddMediaSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const task = await taskDefRepo.getById(payload.taskDefId)
  if (!task) throw new Error(`Task ${payload.taskDefId} not found`)
  const media: TaskMedia = {
    id: newId(),
    taskDefId: task.id,
    kind: payload.kind,
    src: payload.src,
    title: payload.title?.trim() || undefined,
    preview: payload.kind === 'link' ? payload.preview : undefined,
    createdAt: ctx.now.toISOString(),
  }
  await taskMediaRepo.put(media)
  return {
    changes: [{ store: 'taskMedia', id: media.id, changeType: 'created', after: media }],
    summary: `Attach a ${payload.kind === 'image' ? 'picture' : 'link'} to "${task.label}"`,
  }
}

export async function handleTaskRemoveMedia(
  payload: z.infer<typeof taskRemoveMediaSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await taskMediaRepo.getById(payload.id)
  if (!existing) throw new Error(`Attachment ${payload.id} not found`)
  await taskMediaRepo.remove(existing.id)
  return {
    changes: [{ store: 'taskMedia', id: existing.id, changeType: 'deleted', before: existing }],
    summary: `Remove a ${existing.kind === 'image' ? 'picture' : 'link'}`,
  }
}

export async function handleTaskUpdateMedia(
  payload: z.infer<typeof taskUpdateMediaSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await taskMediaRepo.getById(payload.id)
  if (!existing) throw new Error(`Attachment ${payload.id} not found`)
  const updated: TaskMedia = {
    ...existing,
    ...(payload.title !== undefined && { title: payload.title.trim() || undefined }),
    ...(payload.preview !== undefined && existing.kind === 'link' && { preview: payload.preview }),
  }
  await taskMediaRepo.put(updated)
  return {
    changes: [{ store: 'taskMedia', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Update a ${existing.kind === 'image' ? 'picture' : 'link'}`,
  }
}
