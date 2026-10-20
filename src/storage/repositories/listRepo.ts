import { db } from '../db'
import type { ItemList } from '../../domain/types/list'

export const listRepo = {
  async getAll(): Promise<ItemList[]> {
    return db.lists.toArray()
  },
  async getById(id: string): Promise<ItemList | undefined> {
    return db.lists.get(id)
  },
  async put(list: ItemList): Promise<void> {
    await db.lists.put(list)
  },
  async remove(id: string): Promise<void> {
    await db.lists.delete(id)
  },
}
