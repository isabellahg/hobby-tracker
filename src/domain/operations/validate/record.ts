import { z } from 'zod'

export const recordCreateSchema = z.object({
  hobbyId: z.string().min(1).optional(),
  skillId: z.string().optional(),
  date: z.string().min(1),
  description: z.string().min(1),
  value: z.object({ amount: z.number(), unit: z.string() }).optional(),
  sessionId: z.string().optional(),
})

export const recordUpdateSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).optional(),
  value: z.object({ amount: z.number(), unit: z.string() }).optional(),
})

export const recordDeleteSchema = z.object({
  id: z.string().min(1),
})
