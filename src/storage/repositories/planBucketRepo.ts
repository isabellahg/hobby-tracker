import { db } from '../db'
import type { PlanBucket } from '../../domain/types/planBucket'

export const planBucketRepo = {
  async getAll(): Promise<PlanBucket[]> {
    return db.planBuckets.toArray()
  },
  async getById(id: string): Promise<PlanBucket | undefined> {
    return db.planBuckets.get(id)
  },
  async put(bucket: PlanBucket): Promise<void> {
    await db.planBuckets.put(bucket)
  },
  async remove(id: string): Promise<void> {
    await db.planBuckets.delete(id)
  },
}
