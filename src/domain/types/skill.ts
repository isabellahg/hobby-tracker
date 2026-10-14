import type { ID, ISODateTimeString } from './common'

export interface Skill {
  id: ID
  hobbyId: ID
  name: string
  description?: string
  archived: boolean
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}
