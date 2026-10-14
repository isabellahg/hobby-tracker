import { db } from '../db'
import type { Skill } from '../../domain/types/skill'

export const skillRepo = {
  async getAll(): Promise<Skill[]> {
    return db.skills.toArray()
  },
  async getById(id: string): Promise<Skill | undefined> {
    return db.skills.get(id)
  },
  async getByHobby(hobbyId: string): Promise<Skill[]> {
    return db.skills.where('hobbyId').equals(hobbyId).toArray()
  },
  async put(skill: Skill): Promise<void> {
    await db.skills.put(skill)
  },
  async remove(id: string): Promise<void> {
    await db.skills.delete(id)
  },
}
