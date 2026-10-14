import { z } from 'zod'

export const bucketCreateSchema = z.object({
  name: z.string().min(1),
  /** Optional initial tasks, in order — convenient for an LLM building a bucket in one op. */
  taskDefIds: z.array(z.string()).default([]),
})

export const bucketRenameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

export const bucketIdSchema = z.object({
  id: z.string().min(1),
})

export const bucketTaskSchema = z.object({
  bucketId: z.string().min(1),
  taskDefId: z.string().min(1),
})

export const bucketReorderTasksSchema = z.object({
  bucketId: z.string().min(1),
  orderedTaskDefIds: z.array(z.string()).min(1),
})
