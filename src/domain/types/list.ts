import type { ID, ISODateTimeString } from './common'

/**
 * A user-named collection (a reading list, a watch list…) of things you might
 * get to. Its items are ordinary tasks carrying `listId`; they stay out of the
 * backlog unless you put them there. Habits are the one built-in list and
 * have no row here — they're the `recurring` tasks.
 */
export interface ItemList {
  id: ID
  name: string
  order: number
  archived: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}
