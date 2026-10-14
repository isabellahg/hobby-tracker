import { newId } from '../../types/common'
import type { Project } from '../../types/project'
import { projectRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type {
  projectCreateSchema,
  projectSetNextActionSchema,
  projectUpdateSchema,
} from '../validate/project'
import type { z } from 'zod'

export async function handleProjectCreate(
  payload: z.infer<typeof projectCreateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const now = ctx.now.toISOString()
  const project: Project = {
    id: newId(),
    name: payload.name,
    description: payload.description,
    hobbyIds: payload.hobbyIds,
    skillIds: payload.skillIds,
    nextAction: payload.nextAction,
    status: 'active',
    taskEntries: [],
    createdAt: now,
    updatedAt: now,
  }
  await projectRepo.put(project)
  return {
    changes: [{ store: 'projects', id: project.id, changeType: 'created', after: project }],
    summary: `Create project "${project.name}"`,
  }
}

export async function handleProjectUpdate(
  payload: z.infer<typeof projectUpdateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await projectRepo.getById(payload.id)
  if (!existing) throw new Error(`Project ${payload.id} not found`)
  const updated: Project = {
    ...existing,
    name: payload.name ?? existing.name,
    description: payload.description ?? existing.description,
    hobbyIds: payload.hobbyIds ?? existing.hobbyIds,
    skillIds: payload.skillIds ?? existing.skillIds,
    status: payload.status ?? existing.status,
    updatedAt: ctx.now.toISOString(),
  }
  await projectRepo.put(updated)
  return {
    changes: [{ store: 'projects', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Update project "${updated.name}"`,
  }
}

export async function handleProjectSetNextAction(
  payload: z.infer<typeof projectSetNextActionSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await projectRepo.getById(payload.id)
  if (!existing) throw new Error(`Project ${payload.id} not found`)
  const updated: Project = { ...existing, nextAction: payload.nextAction, updatedAt: ctx.now.toISOString() }
  await projectRepo.put(updated)
  return {
    changes: [{ store: 'projects', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Set next action for "${updated.name}": ${payload.nextAction}`,
  }
}
