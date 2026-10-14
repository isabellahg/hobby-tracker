import { z } from 'zod'

export const projectCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  hobbyIds: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  nextAction: z.string().optional(),
})

export const projectUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  hobbyIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
})

export const projectSetNextActionSchema = z.object({
  id: z.string().min(1),
  nextAction: z.string(),
})
