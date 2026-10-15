import { z } from 'zod'

const taskKindSchema = z.enum(['once', 'recurring', 'ongoing'])

export const taskDefCreateSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  hobbyIds: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  kind: taskKindSchema.default('once'),
  nextAction: z.string().optional(),
  defaultEstimateMin: z.number().positive().optional(),
})

export const taskDefUpdateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  hobbyIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  kind: taskKindSchema.optional(),
  nextAction: z.string().optional(),
  defaultEstimateMin: z.number().positive().optional(),
})

export const taskDefArchiveSchema = z.object({
  id: z.string().min(1),
  archived: z.boolean(),
})

export const taskDefFinishSchema = z.object({
  id: z.string().min(1),
  /** Calendar date of the milestone; defaults to today. */
  date: z.string().optional(),
})
