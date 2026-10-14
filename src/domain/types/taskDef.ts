import type { ID, ISODateTimeString } from './common'

/**
 * A reusable task template, shared across routines and plan buckets.
 * Hobby and skill tags are independent/parallel — a task can carry either,
 * both, or neither; picking a skill never requires picking its hobby first.
 */
export interface TaskDef {
  id: ID
  label: string
  description?: string
  hobbyIds: ID[]
  skillIds: ID[]
  defaultEstimateMin?: number
  /**
   * Recurring tasks (habits) stay available in the backlog after being used
   * in a session. One-off tasks (the default) are archived once a session
   * that included them starts, so they don't linger or reappear.
   */
  isRecurring: boolean
  archived: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}
