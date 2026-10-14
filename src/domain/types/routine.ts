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
  archived: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}
