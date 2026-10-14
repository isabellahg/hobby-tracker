import { z } from 'zod'

export const taskDefCreateSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  hobbyIds: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  isRecurring: z.boolean().default(false),
  defaultEstimateMin: z.number().positive().optional(),
})

export const taskDefUpdateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  hobbyIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  isRecurring: z.boolean().optional(),
  defaultEstimateMin: z.number().positive().optional(),
})

export const taskDefArchiveSchema = z.object({
  id: z.string().min(1),
  archived: z.boolean(),
})
