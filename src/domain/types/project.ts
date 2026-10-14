import type { ID, ISODateTimeString } from './common'
import type { SessionTaskEntry } from './session'

export type ProjectStatus = 'active' | 'completed' | 'archived'

/** A long-term grouping of tasks/sessions. Completed tasks stay completed as the project is revisited. */
export interface Project {
  id: ID
  name: string
  description?: string
  hobbyIds: ID[]
  skillIds: ID[]
  nextAction?: string
  status: ProjectStatus
  taskEntries: SessionTaskEntry[]
  createdAt: ISODateTimeString
  updatedAt: ISODateTimeString
}
