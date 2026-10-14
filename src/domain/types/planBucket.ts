import type { ID, ISODateTimeString } from './common'

/**
 * A freely-created, name-only "next session" draft you build on Home by
 * dragging backlog tasks into it. Deliberately has no project, hobby, or
 * skill of its own — those live on the tasks themselves. Starting a bucket
 * turns it into a real Session and the bucket is discarded; tasks it held
 * either go back to the backlog (if recurring) or get archived (if not).
 */
export interface PlanBucketTaskRef {
  id: ID
  taskDefId: ID
  order: number
}

export interface PlanBucket {
  id: ID
  name: string
  taskRefs: PlanBucketTaskRef[]
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}
