import { z } from 'zod'

export const listCreateSchema = z.object({
  name: z.string().min(1),
})

export const listRenameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

export const listArchiveSchema = z.object({
  id: z.string().min(1),
  archived: z.boolean(),
})

export const listReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
})
