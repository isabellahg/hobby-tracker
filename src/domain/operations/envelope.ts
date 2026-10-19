export type OperationName =
  | 'hobby.create'
  | 'hobby.update'
  | 'hobby.archive'
  | 'skill.create'
  | 'skill.update'
  | 'skill.archive'
  | 'taskDef.create'
  | 'taskDef.update'
  | 'taskDef.archive'
  | 'taskDef.finish'
  | 'taskDef.addMedia'
  | 'taskDef.removeMedia'
  | 'taskDef.updateMedia'
  | 'routine.create'
  | 'routine.update'
  | 'routine.duplicate'
  | 'routine.archive'
  | 'routine.reorderTasks'
  | 'routine.addExtraTask'
  | 'routine.removeExtraTask'
  | 'routine.keepExtraTask'
  | 'weeklyPlan.update'
  | 'session.start'
  | 'session.addTask'
  | 'session.setTags'
  | 'session.toggleTask'
  | 'session.skipTask'
  | 'session.setTaskStatus'
  | 'session.addAdHocTask'
  | 'session.addSubtask'
  | 'session.reorderTasks'
  | 'session.pause'
  | 'session.resume'
  | 'session.finish'
  | 'session.discard'
  | 'session.startFromBucket'
  | 'session.rename'
  | 'session.renameTask'
  | 'session.delete'
  | 'bucket.create'
  | 'bucket.rename'
  | 'bucket.delete'
  | 'bucket.addTask'
  | 'bucket.removeTask'
  | 'bucket.reorderTasks'
  | 'record.create'
  | 'record.update'
  | 'record.delete'
  | 'query.calendar'
  | 'query.history'
  | 'query.progress'
// Deliberately absent: any "calendar.setMark" / "streak.set" operation.
// Marks and streaks are always a *computed* consequence of real session
// records; this is what makes it structurally impossible for an LLM (or a
// UI bug) to declare fake activity.

export interface OperationRequest<P = unknown> {
  operation: OperationName
  payload: P
  /** Supplying the same requestId twice is a no-op the second time. */
  requestId?: string
  /** Compute the would-be result without writing anything. */
  dryRun?: boolean
}

export interface ChangedRecord {
  store: string
  id: string
  changeType: 'created' | 'updated' | 'deleted'
  before?: unknown
  after?: unknown
}

export interface OperationError {
  path: string
  message: string
}

export interface OperationResult<D = unknown> {
  success: boolean
  operation: OperationName
  requestId?: string
  errors?: OperationError[]
  changes: ChangedRecord[]
  summary?: string
  data?: D
}

export interface OperationBatchRequest {
  version: 1
  operations: OperationRequest[]
  /** All-or-nothing in one transaction. Default: false (per-op partial success). */
  atomic?: boolean
}

export interface OperationBatchResult {
  success: boolean
  results: OperationResult[]
}
