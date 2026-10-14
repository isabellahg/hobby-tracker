import { db } from '../db'
import type { Hobby } from '../../domain/types/hobby'

export const hobbyRepo = {
  async getAll(): Promise<Hobby[]> {
    return db.hobbies.toArray()
  },
  async getById(id: string): Promise<Hobby | undefined> {
    return db.hobbies.get(id)
  },
  async put(hobby: Hobby): Promise<void> {
    await db.hobbies.put(hobby)
  },
  async remove(id: string): Promise<void> {
    await db.hobbies.delete(id)
  },
}
