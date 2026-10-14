import { db } from '../db'
import type { ISODateString } from '../../domain/types/common'
import type { Session } from '../../domain/types/session'

export const sessionRepo = {
  async getAll(): Promise<Session[]> {
    return db.sessions.toArray()
  },
  async getById(id: string): Promise<Session | undefined> {
    return db.sessions.get(id)
  },
  async getByDateRange(start: ISODateString, end: ISODateString): Promise<Session[]> {
    return db.sessions.where('dateKey').between(start, end, true, true).toArray()
  },
  async getActive(): Promise<Session | undefined> {
    return db.sessions.where('state').equals('in_progress').first()
  },
  async put(session: Session): Promise<void> {
    await db.sessions.put(session)
  },
  async remove(id: string): Promise<void> {
    await db.sessions.delete(id)
  },
}
