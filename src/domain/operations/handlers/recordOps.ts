import { newId } from '../../types/common'
import type { PersonalRecord } from '../../types/record'
import { recordRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type { recordCreateSchema, recordDeleteSchema, recordUpdateSchema } from '../validate/record'
import type { z } from 'zod'

export async function handleRecordCreate(
  payload: z.infer<typeof recordCreateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const record: PersonalRecord = {
    id: newId(),
    hobbyId: payload.hobbyId,
    skillId: payload.skillId,
    date: payload.date,
    description: payload.description,
    value: payload.value,
    sessionId: payload.sessionId,
    createdAt: ctx.now.toISOString(),
  }
  await recordRepo.put(record)
  return {
    changes: [{ store: 'personalRecords', id: record.id, changeType: 'created', after: record }],
    summary: `Record milestone: ${record.description}`,
  }
}

export async function handleRecordUpdate(
  payload: z.infer<typeof recordUpdateSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await recordRepo.getById(payload.id)
  if (!existing) throw new Error(`Record ${payload.id} not found`)
  const updated: PersonalRecord = {
    ...existing,
    description: payload.description ?? existing.description,
    value: payload.value ?? existing.value,
  }
  await recordRepo.put(updated)
  return {
    changes: [{ store: 'personalRecords', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Update milestone: ${updated.description}`,
  }
}

export async function handleRecordDelete(
  payload: z.infer<typeof recordDeleteSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await recordRepo.getById(payload.id)
  if (!existing) throw new Error(`Record ${payload.id} not found`)
  await recordRepo.remove(payload.id)
  return {
    changes: [{ store: 'personalRecords', id: payload.id, changeType: 'deleted', before: existing }],
    summary: `Delete milestone: ${existing.description}`,
  }
}
