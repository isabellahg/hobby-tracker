import { z } from 'zod'

export const routineCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  hobbyIds: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  taskDefIds: z.array(z.string()).default([]), // ordered; taskRefs built from this
})

export const routineUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  hobbyIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  taskDefIds: z.array(z.string()).optional(),
})

export const routineDuplicateSchema = z.object({
  id: z.string().min(1),
  newName: z.string().min(1).optional(),
})

export const routineArchiveSchema = z.object({
  id: z.string().min(1),
  archived: z.boolean(),
})

export const routineReorderTasksSchema = z.object({
  id: z.string().min(1),
  orderedTaskRefIds: z.array(z.string()).min(1),
})

/** Used by addExtraTask, removeExtraTask and keepExtraTask. */
export const routineExtraTaskSchema = z.object({
  routineId: z.string().min(1),
  taskDefId: z.string().min(1),
})
