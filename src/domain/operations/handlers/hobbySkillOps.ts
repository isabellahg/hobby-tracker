import { newId } from '../../types/common'
import type { Hobby } from '../../types/hobby'
import type { Skill } from '../../types/skill'
import { hobbyRepo, skillRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type {
  hobbyArchiveSchema,
  hobbyCreateSchema,
  hobbyUpdateSchema,
  skillArchiveSchema,
  skillCreateSchema,
  skillUpdateSchema,
} from '../validate/hobbySkill'
import type { z } from 'zod'

export async function handleHobbyCreate(
  payload: z.infer<typeof hobbyCreateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const now = ctx.now.toISOString()
  const hobby: Hobby = {
    id: newId(),
    name: payload.name,
    description: payload.description,
    color: payload.color,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  await hobbyRepo.put(hobby)
  return {
    changes: [{ store: 'hobbies', id: hobby.id, changeType: 'created', after: hobby }],
    summary: `Create hobby "${hobby.name}"`,
  }
}

export async function handleHobbyUpdate(
  payload: z.infer<typeof hobbyUpdateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await hobbyRepo.getById(payload.id)
  if (!existing) throw new Error(`Hobby ${payload.id} not found`)
  const updated: Hobby = {
    ...existing,
    name: payload.name ?? existing.name,
    description: payload.description ?? existing.description,
    color: payload.color ?? existing.color,
    updatedAt: ctx.now.toISOString(),
  }
  await hobbyRepo.put(updated)
  return {
    changes: [{ store: 'hobbies', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Update hobby "${updated.name}"`,
  }
}

export async function handleHobbyArchive(
  payload: z.infer<typeof hobbyArchiveSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await hobbyRepo.getById(payload.id)
  if (!existing) throw new Error(`Hobby ${payload.id} not found`)
  const updated: Hobby = { ...existing, archived: payload.archived, updatedAt: ctx.now.toISOString() }
  await hobbyRepo.put(updated)
  return {
    changes: [{ store: 'hobbies', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `${payload.archived ? 'Archive' : 'Unarchive'} hobby "${updated.name}"`,
  }
}

export async function handleSkillCreate(
  payload: z.infer<typeof skillCreateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const hobby = await hobbyRepo.getById(payload.hobbyId)
  if (!hobby) throw new Error(`Hobby ${payload.hobbyId} not found`)
  const now = ctx.now.toISOString()
  const skill: Skill = {
    id: newId(),
    hobbyId: payload.hobbyId,
    name: payload.name,
    description: payload.description,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  await skillRepo.put(skill)
  return {
    changes: [{ store: 'skills', id: skill.id, changeType: 'created', after: skill }],
    summary: `Create skill "${skill.name}" under "${hobby.name}"`,
  }
}

export async function handleSkillUpdate(
  payload: z.infer<typeof skillUpdateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await skillRepo.getById(payload.id)
  if (!existing) throw new Error(`Skill ${payload.id} not found`)
  const updated: Skill = {
    ...existing,
    name: payload.name ?? existing.name,
    description: payload.description ?? existing.description,
    updatedAt: ctx.now.toISOString(),
  }
  await skillRepo.put(updated)
  return {
    changes: [{ store: 'skills', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Update skill "${updated.name}"`,
  }
}

export async function handleSkillArchive(
  payload: z.infer<typeof skillArchiveSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await skillRepo.getById(payload.id)
  if (!existing) throw new Error(`Skill ${payload.id} not found`)
  const updated: Skill = { ...existing, archived: payload.archived, updatedAt: ctx.now.toISOString() }
  await skillRepo.put(updated)
  return {
    changes: [{ store: 'skills', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `${payload.archived ? 'Archive' : 'Unarchive'} skill "${updated.name}"`,
  }
}
