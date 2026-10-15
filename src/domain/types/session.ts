import type { ID, ISODateString, ISODateTimeString } from './common'

export type SessionTaskStatus = 'pending' | 'completed' | 'skipped'

/**
 * A session-instance task. Label, hobbyIds and skillIds are snapshotted at
 * the time the entry was created so later edits to the originating TaskDef
 * never rewrite history.
 */
export interface SessionTaskEntry {
  id: ID
  taskDefId?: ID
  label: string
  hobbyIds: ID[]
  skillIds: ID[]
  status: SessionTaskStatus
  order: number
  isAdHoc: boolean
  completedAt?: ISODateTimeString
}

export type SessionState = 'in_progress' | 'finished' | 'discarded'

export interface PausedInterval {
  pausedAt: ISODateTimeString
  resumedAt?: ISODateTimeString
}

export interface Session {
  id: ID
  /** User-facing name; seeded from the plan bucket it was started from. */
  name?: string
  routineId?: ID
  hobbyIds: ID[]
  skillIds: ID[]
  taskEntries: SessionTaskEntry[]
  startedAt: ISODateTimeString
  pausedIntervals: PausedInterval[]
  finishedAt?: ISODateTimeString
  discardedAt?: ISODateTimeString
  state: SessionState
  /** Computed at finish; excludes paused time. */
  durationSec?: number
  /** Calendar date this session attributes to, derived from startedAt. */
  dateKey: ISODateString
  note?: string
}
