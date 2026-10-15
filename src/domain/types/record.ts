import type { ID, ISODateString, ISODateTimeString } from './common'

/** A flexible, user-defined milestone. Not a universal metric. */
export interface PersonalRecord {
  id: ID
  hobbyId?: ID
  skillId?: ID
  date: ISODateString
  description: string
  value?: { amount: number; unit: string }
  sessionId?: ID
  /** Set when the milestone was recorded by finishing an ongoing task. */
  taskDefId?: ID
  createdAt: ISODateTimeString
}
