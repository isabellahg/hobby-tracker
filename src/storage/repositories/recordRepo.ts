import { db } from '../db'
import type { PersonalRecord } from '../../domain/types/record'

export const recordRepo = {
  async getAll(): Promise<PersonalRecord[]> {
    return db.personalRecords.toArray()
  },
  async getById(id: string): Promise<PersonalRecord | undefined> {
    return db.personalRecords.get(id)
  },
  async getByHobby(hobbyId: string): Promise<PersonalRecord[]> {
    return db.personalRecords.where('hobbyId').equals(hobbyId).toArray()
  },
  async put(record: PersonalRecord): Promise<void> {
    await db.personalRecords.put(record)
  },
  async remove(id: string): Promise<void> {
    await db.personalRecords.delete(id)
  },
}
