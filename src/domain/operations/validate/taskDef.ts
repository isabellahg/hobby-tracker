import { z } from 'zod'

const taskKindSchema = z.enum(['once', 'recurring', 'ongoing'])

export const itemStatusSchema = z.enum(['want', 'ongoing', 'paused', 'abandoned', 'done'])

export const habitFrequencySchema = z.object({
  period: z.enum(['day', 'week', 'month']),
  min: z.number().int().positive(),
  avg: z.number().int().positive(),
  amazing: z.number().int().positive(),
})

/** Fields shared by create and update for list items and habits. */
const listFields = {
  status: itemStatusSchema.optional(),
  inBacklog: z.boolean().optional(),
  habit: habitFrequencySchema.optional(),
}

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
  /** Puts it on a user list instead of the backlog. */
  listId: z.string().min(1).optional(),
  ...listFields,
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
  ...listFields,
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

export const taskDefSetStatusSchema = z.object({
  id: z.string().min(1),
  status: itemStatusSchema,
})

/** 'backlog' takes it off any list, 'habits' makes it a habit, anything else is a list id. */
export const taskDefMoveToSchema = z.object({
  id: z.string().min(1),
  target: z.string().min(1),
})
