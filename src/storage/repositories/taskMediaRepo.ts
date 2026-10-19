import { db } from '../db'
import type { TaskMedia } from '../../domain/types/taskMedia'

export const taskMediaRepo = {
  async getAll(): Promise<TaskMedia[]> {
    return db.taskMedia.toArray()
  },
  async getById(id: string): Promise<TaskMedia | undefined> {
    return db.taskMedia.get(id)
  },
  async put(media: TaskMedia): Promise<void> {
    await db.taskMedia.put(media)
  },
  async remove(id: string): Promise<void> {
    await db.taskMedia.delete(id)
  },
}
