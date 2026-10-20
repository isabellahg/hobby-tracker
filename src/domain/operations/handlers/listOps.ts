import { newId } from '../../types/common'
import type { ItemList } from '../../types/list'
import { listRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type { listArchiveSchema, listCreateSchema, listRenameSchema, listReorderSchema } from '../validate/list'
import type { z } from 'zod'

export async function requireList(id: string): Promise<ItemList> {
  const list = await listRepo.getById(id)
  if (!list) throw new Error(`List ${id} not found`)
  return list
}

export async function handleListCreate(
  payload: z.infer<typeof listCreateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const now = ctx.now.toISOString()
  const existing = await listRepo.getAll()
  const list: ItemList = {
    id: newId(),
    name: payload.name,
    order: existing.reduce((max, l) => Math.max(max, l.order + 1), 0),
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  await listRepo.put(list)
  return {
    changes: [{ store: 'lists', id: list.id, changeType: 'created', after: list }],
    summary: `Create list "${list.name}"`,
  }
}

export async function handleListRename(
  payload: z.infer<typeof listRenameSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireList(payload.id)
  const updated: ItemList = { ...existing, name: payload.name, updatedAt: ctx.now.toISOString() }
  await listRepo.put(updated)
  return {
    changes: [{ store: 'lists', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Rename list "${existing.name}" to "${updated.name}"`,
  }
}

/** Archiving hides the list and its items everywhere; they come back with it on restore. */
export async function handleListArchive(
  payload: z.infer<typeof listArchiveSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireList(payload.id)
  const updated: ItemList = { ...existing, archived: payload.archived, updatedAt: ctx.now.toISOString() }
  await listRepo.put(updated)
  return {
    changes: [{ store: 'lists', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `${payload.archived ? 'Archive' : 'Restore'} list "${existing.name}"`,
  }
}

export async function handleListReorder(
  payload: z.infer<typeof listReorderSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const changes: ChangedRecord[] = []
  for (const [order, id] of payload.orderedIds.entries()) {
    const existing = await requireList(id)
    if (existing.order === order) continue
    const updated: ItemList = { ...existing, order, updatedAt: ctx.now.toISOString() }
    await listRepo.put(updated)
    changes.push({ store: 'lists', id, changeType: 'updated', before: existing, after: updated })
  }
  return { changes, summary: 'Reorder lists' }
}
