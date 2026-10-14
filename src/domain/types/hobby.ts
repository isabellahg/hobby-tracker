import type { ID, ISODateTimeString } from './common'

export interface Hobby {
  id: ID
  name: string
  description?: string
  color?: string
  archived: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}
