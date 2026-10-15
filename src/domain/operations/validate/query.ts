import { z } from 'zod'

export const queryCalendarSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
})

export const queryHistorySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  routineId: z.string().optional(),
  hobbyId: z.string().optional(),
  skillId: z.string().optional(),
})

export const queryProgressSchema = z.object({
  hobbyId: z.string().optional(),
  skillId: z.string().optional(),
})
