import { z } from 'zod'

export const hobbyCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
})

export const hobbyUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
})

export const hobbyArchiveSchema = z.object({
  id: z.string().min(1),
  archived: z.boolean(),
})

export const skillCreateSchema = z.object({
  hobbyId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
})

export const skillUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

export const skillArchiveSchema = z.object({
  id: z.string().min(1),
  archived: z.boolean(),
})
