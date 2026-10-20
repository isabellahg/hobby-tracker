import type { ID, ISODateTimeString } from './common'

/**
 * - `once`: leaves the backlog once completed in a session planned from Home.
 * - `recurring`: a habit; never leaves on its own. Top-level ones live in the
 *   Habits list instead of the plain backlog.
 * - `ongoing`: a long effort (e.g. a course) worked on across many sessions;
 *   leaves only when explicitly marked finished, which records a milestone.
 */
export type TaskKind = 'once' | 'recurring' | 'ongoing'

/** Where a list item or habit stands. Habits never use `done`. */
export type ItemStatus = 'want' | 'ongoing' | 'paused' | 'abandoned' | 'done'

export type HabitPeriod = 'day' | 'week' | 'month'

/** How often a habit should happen per period: the floor, the usual, and a great run. */
export interface HabitFrequency {
  period: HabitPeriod
  min: number
  avg: number
  amazing: number
}

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
  /** Parent task when this is a subtask. Children are plain tasks; no manual order. */
  parentId?: ID
  /** What to do next on an ongoing task. */
  nextAction?: string
  /** Member of a user list (reading, watch…). */
  listId?: ID
  /** State inside its list, or of a habit. */
  status?: ItemStatus
  /** When `status` last changed — feeds the "been ongoing a while" nudge. */
  statusAt?: ISODateTimeString
  /** A list item that also sits in the plain backlog. Removing it from there never takes it off the list. */
  inBacklog?: boolean
  /** Habits only. */
  habit?: HabitFrequency
  archived: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}
