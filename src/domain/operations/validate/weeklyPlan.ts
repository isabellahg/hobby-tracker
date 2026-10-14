import { z } from 'zod'

const dayOfWeekSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
])

export const weeklyPlanUpdateSchema = z.object({
  /** Replaces the routine assignment for each listed day; days not listed are left as-is. */
  set: z.array(
    z.object({
      day: dayOfWeekSchema,
      routineIds: z.array(z.string()),
    }),
  ),
})
