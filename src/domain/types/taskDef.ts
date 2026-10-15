import type { ID, ISODateTimeString } from './common'

/**
 * - `once`: leaves the backlog once completed in a session planned from Home.
 * - `recurring`: a habit; never leaves on its own.
 * - `ongoing`: a long effort (e.g. a course) worked on across many sessions;
 *   leaves only when explicitly marked finished, which records a milestone.
 */
export type TaskKind = 'once' | 'recurring' | 'ongoing'

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
  kind: TaskKind
  /** What to do next on an ongoing task. */
  nextAction?: string
  archived: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}
