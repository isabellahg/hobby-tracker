import { db } from '../db'
import type { Routine } from '../../domain/types/routine'

export const routineRepo = {
  async getAll(): Promise<Routine[]> {
    return db.routines.toArray()
  },
  async getById(id: string): Promise<Routine | undefined> {
    return db.routines.get(id)
  },
  async getByIds(ids: string[]): Promise<Routine[]> {
    const rows = await db.routines.bulkGet(ids)
    return rows.filter((r): r is Routine => r !== undefined)
  },
  async put(routine: Routine): Promise<void> {
    await db.routines.put(routine)
  },
  async remove(id: string): Promise<void> {
    await db.routines.delete(id)
  },
}
