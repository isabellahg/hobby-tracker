import { z } from 'zod'

const taskKindSchema = z.enum(['once', 'recurring', 'ongoing'])

export const taskDefCreateSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  /** Omitted on a subtask → copied from the parent. */
  hobbyIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  kind: taskKindSchema.default('once'),
  nextAction: z.string().optional(),
  defaultEstimateMin: z.number().positive().optional(),
  /** Makes this a subtask of an open task. */
  parentId: z.string().min(1).optional(),
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
  /** null moves the task to the top level. */
  parentId: z.string().min(1).nullable().optional(),
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
