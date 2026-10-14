import { db } from '../db'
import type { Project } from '../../domain/types/project'

export const projectRepo = {
  async getAll(): Promise<Project[]> {
    return db.projects.toArray()
  },
  async getById(id: string): Promise<Project | undefined> {
    return db.projects.get(id)
  },
  async getActive(): Promise<Project[]> {
    return db.projects.where('status').equals('active').toArray()
  },
  async put(project: Project): Promise<void> {
    await db.projects.put(project)
  },
  async remove(id: string): Promise<void> {
    await db.projects.delete(id)
  },
}
