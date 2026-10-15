import type { ID, ISODateTimeString } from './common'

/**
 * A freely-created, name-only "next session" draft you build on Home by
 * dragging backlog tasks into it. Deliberately has no hobby or skill of its
 * own — those live on the tasks themselves. Starting a bucket turns it into
 * a real Session named after it, and the bucket is discarded.
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
