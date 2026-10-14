import { db } from '../db'
import type { TaskDef } from '../../domain/types/taskDef'

export const taskDefRepo = {
  async getAll(): Promise<TaskDef[]> {
    return db.taskDefs.toArray()
  },
  async getById(id: string): Promise<TaskDef | undefined> {
    return db.taskDefs.get(id)
  },
  async getByIds(ids: string[]): Promise<TaskDef[]> {
    const rows = await db.taskDefs.bulkGet(ids)
    return rows.filter((r): r is TaskDef => r !== undefined)
  },
  async put(taskDef: TaskDef): Promise<void> {
    await db.taskDefs.put(taskDef)
  },
  async remove(id: string): Promise<void> {
    await db.taskDefs.delete(id)
  },
}
