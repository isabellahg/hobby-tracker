import { newId } from '../../types/common'
import type { Routine, RoutineTaskRef } from '../../types/routine'
import { routineRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type {
  routineArchiveSchema,
  routineCreateSchema,
  routineDuplicateSchema,
  routineExtraTaskSchema,
  routineReorderTasksSchema,
  routineUpdateSchema,
} from '../validate/routine'
import type { z } from 'zod'

function buildTaskRefs(taskDefIds: string[]): RoutineTaskRef[] {
  return taskDefIds.map((taskDefId, order) => ({ id: newId(), taskDefId, order }))
}

export async function handleRoutineCreate(
  payload: z.infer<typeof routineCreateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const now = ctx.now.toISOString()
  const routine: Routine = {
    id: newId(),
    name: payload.name,
    description: payload.description,
    hobbyIds: payload.hobbyIds,
    skillIds: payload.skillIds,
    taskRefs: buildTaskRefs(payload.taskDefIds),
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  await routineRepo.put(routine)
  return {
    changes: [{ store: 'routines', id: routine.id, changeType: 'created', after: routine }],
    summary: `Create routine "${routine.name}" (${routine.taskRefs.length} tasks)`,
  }
}

export async function handleRoutineUpdate(
  payload: z.infer<typeof routineUpdateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await routineRepo.getById(payload.id)
  if (!existing) throw new Error(`Routine ${payload.id} not found`)
  const updated: Routine = {
    ...existing,
    name: payload.name ?? existing.name,
    description: payload.description ?? existing.description,
    hobbyIds: payload.hobbyIds ?? existing.hobbyIds,
    skillIds: payload.skillIds ?? existing.skillIds,
    taskRefs: payload.taskDefIds ? buildTaskRefs(payload.taskDefIds) : existing.taskRefs,
    updatedAt: ctx.now.toISOString(),
  }
  await routineRepo.put(updated)
  return {
    changes: [{ store: 'routines', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Update routine "${updated.name}"`,
  }
}

export async function handleRoutineDuplicate(
  payload: z.infer<typeof routineDuplicateSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await routineRepo.getById(payload.id)
  if (!existing) throw new Error(`Routine ${payload.id} not found`)
  const now = ctx.now.toISOString()
  const copy: Routine = {
    ...existing,
    id: newId(),
    name: payload.newName ?? `${existing.name} (copy)`,
    taskRefs: existing.taskRefs.map((ref) => ({ ...ref, id: newId() })),
    extraTaskRefs: [],
    createdAt: now,
    updatedAt: now,
  }
  await routineRepo.put(copy)
  return {
    changes: [{ store: 'routines', id: copy.id, changeType: 'created', after: copy }],
    summary: `Duplicate routine "${existing.name}" as "${copy.name}"`,
  }
}

export async function handleRoutineArchive(
  payload: z.infer<typeof routineArchiveSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await routineRepo.getById(payload.id)
  if (!existing) throw new Error(`Routine ${payload.id} not found`)
  const updated: Routine = { ...existing, archived: payload.archived, updatedAt: ctx.now.toISOString() }
  await routineRepo.put(updated)
  return {
    changes: [{ store: 'routines', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `${payload.archived ? 'Archive' : 'Unarchive'} routine "${updated.name}"`,
  }
}

export async function handleRoutineReorderTasks(
  payload: z.infer<typeof routineReorderTasksSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await routineRepo.getById(payload.id)
  if (!existing) throw new Error(`Routine ${payload.id} not found`)
  const orderIndex = new Map(payload.orderedTaskRefIds.map((id, index) => [id, index]))
  const updated: Routine = {
    ...existing,
    taskRefs: existing.taskRefs
      .map((ref) => ({ ...ref, order: orderIndex.get(ref.id) ?? ref.order }))
      .sort((a, b) => a.order - b.order),
    updatedAt: ctx.now.toISOString(),
  }
  await routineRepo.put(updated)
  return {
    changes: [{ store: 'routines', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Reorder tasks in routine "${updated.name}"`,
  }
}

async function requireRoutine(id: string): Promise<Routine> {
  const routine = await routineRepo.getById(id)
  if (!routine) throw new Error(`Routine ${id} not found`)
  return routine
}

function nextOrder(refs: RoutineTaskRef[]): number {
  return refs.length ? Math.max(...refs.map((r) => r.order)) + 1 : 0
}

/** Adds a task to the routine's next run only. */
export async function handleRoutineAddExtraTask(
  payload: z.infer<typeof routineExtraTaskSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireRoutine(payload.routineId)
  const extras = existing.extraTaskRefs ?? []
  const alreadyThere =
    existing.taskRefs.some((r) => r.taskDefId === payload.taskDefId) ||
    extras.some((r) => r.taskDefId === payload.taskDefId)
  if (alreadyThere) return { changes: [], summary: `Task already in "${existing.name}"` }

  const updated: Routine = {
    ...existing,
    extraTaskRefs: [...extras, { id: newId(), taskDefId: payload.taskDefId, order: nextOrder(extras) }],
    updatedAt: ctx.now.toISOString(),
  }
  await routineRepo.put(updated)
  return {
    changes: [{ store: 'routines', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Add a task to the next run of "${updated.name}"`,
  }
}

export async function handleRoutineRemoveExtraTask(
  payload: z.infer<typeof routineExtraTaskSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireRoutine(payload.routineId)
  const updated: Routine = {
    ...existing,
    extraTaskRefs: (existing.extraTaskRefs ?? []).filter((r) => r.taskDefId !== payload.taskDefId),
    updatedAt: ctx.now.toISOString(),
  }
  await routineRepo.put(updated)
  return {
    changes: [{ store: 'routines', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Remove a task from the next run of "${updated.name}"`,
  }
}

/** Promotes a next-run-only task into the routine itself. */
export async function handleRoutineKeepExtraTask(
  payload: z.infer<typeof routineExtraTaskSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string }> {
  const existing = await requireRoutine(payload.routineId)
  const extras = existing.extraTaskRefs ?? []
  if (!extras.some((r) => r.taskDefId === payload.taskDefId)) {
    throw new Error(`That task isn't a next-run extra of "${existing.name}"`)
  }
  const updated: Routine = {
    ...existing,
    taskRefs: [
      ...existing.taskRefs,
      { id: newId(), taskDefId: payload.taskDefId, order: nextOrder(existing.taskRefs) },
    ],
    extraTaskRefs: extras.filter((r) => r.taskDefId !== payload.taskDefId),
    updatedAt: ctx.now.toISOString(),
  }
  await routineRepo.put(updated)
  return {
    changes: [{ store: 'routines', id: updated.id, changeType: 'updated', before: existing, after: updated }],
    summary: `Keep the task in "${updated.name}" for good`,
  }
}
