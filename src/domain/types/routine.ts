import type { ID, ISODateTimeString } from './common'

/** An ordered pointer into the task library, stable across reorders. */
export interface RoutineTaskRef {
  id: ID
  taskDefId: ID
  order: number
}

/** A reusable, ordered template of tasks that may span several hobbies/skills. */
export interface Routine {
  id: ID
  name: string
  description?: string
  hobbyIds: ID[]
  skillIds: ID[]
  taskRefs: RoutineTaskRef[]
  /**
   * Tasks added for the next run only (e.g. "today I'll also draw X").
   * Seeded into the session after the routine's own tasks, then cleared.
   */
  extraTaskRefs?: RoutineTaskRef[]
  archived: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}
