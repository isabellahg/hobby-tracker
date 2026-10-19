import type { ZodType } from 'zod'
import { db } from '../../storage/db'
import { metaRepo } from '../../storage/repositories'
import type { OperationContext } from './context'
import type { ChangedRecord, OperationName, OperationRequest, OperationResult } from './envelope'
import * as v from './validate'
import {
  handleHobbyArchive,
  handleHobbyCreate,
  handleHobbyUpdate,
  handleSkillArchive,
  handleSkillCreate,
  handleSkillUpdate,
} from './handlers/hobbySkillOps'
import {
  handleTaskDefArchive,
  handleTaskDefCreate,
  handleTaskDefFinish,
  handleTaskDefUpdate,
} from './handlers/taskDefOps'
import {
  handleRoutineAddExtraTask,
  handleRoutineArchive,
  handleRoutineCreate,
  handleRoutineDuplicate,
  handleRoutineKeepExtraTask,
  handleRoutineRemoveExtraTask,
  handleRoutineReorderTasks,
  handleRoutineUpdate,
} from './handlers/routineOps'
import { handleTaskAddMedia, handleTaskRemoveMedia, handleTaskUpdateMedia } from './handlers/taskMediaOps'
import { handleWeeklyPlanUpdate } from './handlers/weeklyPlanOps'
import {
  handleSessionAddAdHocTask,
  handleSessionAddSubtask,
  handleSessionAddTask,
  handleSessionDelete,
  handleSessionSetTags,
  handleSessionDiscard,
  handleSessionFinish,
  handleSessionPause,
  handleSessionRename,
  handleSessionRenameTask,
  handleSessionReorderTasks,
  handleSessionResume,
  handleSessionSetTaskStatus,
  handleSessionSkipTask,
  handleSessionStart,
  handleSessionStartFromBucket,
  handleSessionToggleTask,
} from './handlers/sessionOps'
import { handleRecordCreate, handleRecordDelete, handleRecordUpdate } from './handlers/recordOps'
import { handleQueryCalendar, handleQueryHistory, handleQueryProgress } from './handlers/queryOps'
import {
  handleBucketAddTask,
  handleBucketCreate,
  handleBucketDelete,
  handleBucketRemoveTask,
  handleBucketRename,
  handleBucketReorderTasks,
} from './handlers/planBucketOps'

interface HandlerResult {
  changes: ChangedRecord[]
  summary: string
  data?: unknown
}

interface RegistryEntry {
  schema: ZodType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handle: (payload: any, ctx: OperationContext) => Promise<HandlerResult>
}

const handlers: Record<OperationName, RegistryEntry> = {
  'hobby.create': { schema: v.hobbyCreateSchema, handle: handleHobbyCreate },
  'hobby.update': { schema: v.hobbyUpdateSchema, handle: handleHobbyUpdate },
  'hobby.archive': { schema: v.hobbyArchiveSchema, handle: handleHobbyArchive },
  'skill.create': { schema: v.skillCreateSchema, handle: handleSkillCreate },
  'skill.update': { schema: v.skillUpdateSchema, handle: handleSkillUpdate },
  'skill.archive': { schema: v.skillArchiveSchema, handle: handleSkillArchive },
  'taskDef.create': { schema: v.taskDefCreateSchema, handle: handleTaskDefCreate },
  'taskDef.update': { schema: v.taskDefUpdateSchema, handle: handleTaskDefUpdate },
  'taskDef.archive': { schema: v.taskDefArchiveSchema, handle: handleTaskDefArchive },
  'taskDef.finish': { schema: v.taskDefFinishSchema, handle: handleTaskDefFinish },
  'taskDef.addMedia': { schema: v.taskAddMediaSchema, handle: handleTaskAddMedia },
  'taskDef.removeMedia': { schema: v.taskRemoveMediaSchema, handle: handleTaskRemoveMedia },
  'taskDef.updateMedia': { schema: v.taskUpdateMediaSchema, handle: handleTaskUpdateMedia },
  'routine.create': { schema: v.routineCreateSchema, handle: handleRoutineCreate },
  'routine.update': { schema: v.routineUpdateSchema, handle: handleRoutineUpdate },
  'routine.duplicate': { schema: v.routineDuplicateSchema, handle: handleRoutineDuplicate },
  'routine.archive': { schema: v.routineArchiveSchema, handle: handleRoutineArchive },
  'routine.reorderTasks': { schema: v.routineReorderTasksSchema, handle: handleRoutineReorderTasks },
  'routine.addExtraTask': { schema: v.routineExtraTaskSchema, handle: handleRoutineAddExtraTask },
  'routine.removeExtraTask': { schema: v.routineExtraTaskSchema, handle: handleRoutineRemoveExtraTask },
  'routine.keepExtraTask': { schema: v.routineExtraTaskSchema, handle: handleRoutineKeepExtraTask },
  'weeklyPlan.update': { schema: v.weeklyPlanUpdateSchema, handle: handleWeeklyPlanUpdate },
  'session.start': { schema: v.sessionStartSchema, handle: handleSessionStart },
  'session.addTask': { schema: v.sessionAddTaskSchema, handle: handleSessionAddTask },
  'session.setTags': { schema: v.sessionSetTagsSchema, handle: handleSessionSetTags },
  'session.toggleTask': { schema: v.sessionEntryIdSchema, handle: handleSessionToggleTask },
  'session.skipTask': { schema: v.sessionEntryIdSchema, handle: handleSessionSkipTask },
  'session.setTaskStatus': { schema: v.sessionSetTaskStatusSchema, handle: handleSessionSetTaskStatus },
  'session.addAdHocTask': { schema: v.sessionAddAdHocTaskSchema, handle: handleSessionAddAdHocTask },
  'session.addSubtask': { schema: v.sessionAddSubtaskSchema, handle: handleSessionAddSubtask },
  'session.reorderTasks': { schema: v.sessionReorderTasksSchema, handle: handleSessionReorderTasks },
  'session.pause': { schema: v.sessionIdSchema, handle: handleSessionPause },
  'session.resume': { schema: v.sessionIdSchema, handle: handleSessionResume },
  'session.finish': { schema: v.sessionFinishSchema, handle: handleSessionFinish },
  'session.discard': { schema: v.sessionIdSchema, handle: handleSessionDiscard },
  'session.startFromBucket': { schema: v.sessionStartFromBucketSchema, handle: handleSessionStartFromBucket },
  'session.rename': { schema: v.sessionRenameSchema, handle: handleSessionRename },
  'session.renameTask': { schema: v.sessionRenameTaskSchema, handle: handleSessionRenameTask },
  'session.delete': { schema: v.sessionIdSchema, handle: handleSessionDelete },
  'bucket.create': { schema: v.bucketCreateSchema, handle: handleBucketCreate },
  'bucket.rename': { schema: v.bucketRenameSchema, handle: handleBucketRename },
  'bucket.delete': { schema: v.bucketIdSchema, handle: handleBucketDelete },
  'bucket.addTask': { schema: v.bucketTaskSchema, handle: handleBucketAddTask },
  'bucket.removeTask': { schema: v.bucketTaskSchema, handle: handleBucketRemoveTask },
  'bucket.reorderTasks': { schema: v.bucketReorderTasksSchema, handle: handleBucketReorderTasks },
  'record.create': { schema: v.recordCreateSchema, handle: handleRecordCreate },
  'record.update': { schema: v.recordUpdateSchema, handle: handleRecordUpdate },
  'record.delete': { schema: v.recordDeleteSchema, handle: handleRecordDelete },
  'query.calendar': { schema: v.queryCalendarSchema, handle: handleQueryCalendar },
  'query.history': { schema: v.queryHistorySchema, handle: handleQueryHistory },
  'query.progress': { schema: v.queryProgressSchema, handle: handleQueryProgress },}

/**
 * Thrown internally to abort a Dexie transaction we never intended to
 * commit — the carrier for a dry-run preview's result. Caught by whichever
 * call (`applyOperation` or `applyBatch`) opened that transaction.
 */
class PreviewAbort<T> extends Error {
  payload: T
  constructor(payload: T) {
    super('preview-abort')
    this.payload = payload
  }
}

/**
 * Validates, checks idempotency, and runs the handler — with no opinion on
 * whether its writes should actually commit. Callers that want a dry-run
 * preview wrap this (or a sequence of these) in a transaction they roll
 * back; callers applying for real just let it run normally.
 */
async function executeOperationRaw(
  req: OperationRequest,
  ctx: OperationContext,
): Promise<OperationResult> {
  const entry = handlers[req.operation]
  if (!entry) {
    return {
      success: false,
      operation: req.operation,
      requestId: req.requestId,
      errors: [{ path: 'operation', message: `Unknown operation "${req.operation}"` }],
      changes: [],
    }
  }

  const parsed = entry.schema.safeParse(req.payload)
  if (!parsed.success) {
    return {
      success: false,
      operation: req.operation,
      requestId: req.requestId,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
      changes: [],
    }
  }

  if (req.requestId && (await metaRepo.wasRequestApplied(req.requestId))) {
    return {
      success: true,
      operation: req.operation,
      requestId: req.requestId,
      changes: [],
      summary: 'Skipped — already applied',
    }
  }

  try {
    const result = await entry.handle(parsed.data, ctx)
    if (req.requestId) await metaRepo.markRequestApplied(req.requestId)
    return {
      success: true,
      operation: req.operation,
      requestId: req.requestId,
      changes: result.changes,
      summary: result.summary,
      data: result.data,
    }
  } catch (err) {
    return {
      success: false,
      operation: req.operation,
      requestId: req.requestId,
      errors: [{ path: '(handler)', message: err instanceof Error ? err.message : String(err) }],
      changes: [],
    }
  }
}

export async function applyOperation(
  req: OperationRequest,
  ctxIn: OperationContext,
): Promise<OperationResult> {
  // A request's own `dryRun` flag (used by the Import preview flow) always
  // wins over the caller's context, but never downgrades an outer dry-run.
  const ctx: OperationContext = { ...ctxIn, dryRun: ctxIn.dryRun || !!req.dryRun }

  if (!ctx.dryRun) return executeOperationRaw(req, ctx)

  // Preview mode: actually run the handler (so e.g. a created id is real
  // and reads of it succeed) inside a transaction, then deliberately abort
  // so nothing is kept.
  try {
    let result!: OperationResult
    await db.transaction('rw', db.tables, async () => {
      result = await executeOperationRaw(req, ctx)
      throw new PreviewAbort(result)
    })
    return result
  } catch (err) {
    if (err instanceof PreviewAbort) return err.payload as OperationResult
    throw err
  }
}

export interface OperationBatchRequestLike {
  version: 1
  operations: OperationRequest[]
  atomic?: boolean
}

/**
 * Resolves `"$ref:<opIndex>"` string markers anywhere in a payload to the id
 * created by an earlier operation in the same batch — e.g. a batch that
 * creates five tasks and then a routine can reference each task as
 * `"$ref:0"`.."$ref:4"` in the routine's `taskDefIds`. This works even
 * during a dry-run preview, since every create handler generates its id
 * before checking whether to actually persist.
 */
function resolveRefs(value: unknown, priorResults: OperationResult[]): unknown {
  if (typeof value === 'string') {
    const match = /^\$ref:(\d+)$/.exec(value)
    if (!match) return value
    const index = Number(match[1])
    const id = priorResults[index]?.changes[0]?.id
    if (id === undefined) {
      throw new Error(`$ref:${index} does not refer to a prior operation that created a record`)
    }
    return id
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, priorResults))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveRefs(v, priorResults)
    return out
  }
  return value
}

/**
 * Runs each operation via the non-wrapping executor, so a caller that has
 * already opened a transaction (for atomic apply or for a whole-batch dry
 * run) sees every op's writes immediately visible to the next op's reads —
 * which is what lets `$ref` chains and "start a session, then finish it"
 * work within a single preview. The batch-level `ctx.dryRun` applies
 * uniformly; a per-operation `dryRun` flag is only honored via a standalone
 * `applyOperation` call, not inside a batch.
 */
async function runSequential(
  operations: OperationRequest[],
  ctx: OperationContext,
): Promise<OperationResult[]> {
  const results: OperationResult[] = []
  for (const op of operations) {
    let resolvedOp = op
    try {
      resolvedOp = { ...op, payload: resolveRefs(op.payload, results) }
    } catch (err) {
      results.push({
        success: false,
        operation: op.operation,
        requestId: op.requestId,
        errors: [{ path: '(ref)', message: err instanceof Error ? err.message : String(err) }],
        changes: [],
      })
      continue
    }
    results.push(await executeOperationRaw(resolvedOp, ctx))
  }
  return results
}

export async function applyBatch(
  batch: OperationBatchRequestLike,
  ctx: OperationContext,
): Promise<{ success: boolean; results: OperationResult[] }> {
  if (ctx.dryRun) {
    // One shared transaction for the whole batch, always rolled back at the
    // end, so every op's writes are visible to later ops during the preview
    // but nothing is actually kept.
    try {
      await db.transaction('rw', db.tables, async () => {
        throw new PreviewAbort(await runSequential(batch.operations, ctx))
      })
      /* istanbul ignore next -- the transaction above always throws */
      throw new Error('unreachable')
    } catch (err) {
      if (!(err instanceof PreviewAbort)) throw err
      const results = err.payload as OperationResult[]
      return { success: results.every((r) => r.success), results }
    }
  }

  if (batch.atomic) {
    let results: OperationResult[] = []
    try {
      await db.transaction('rw', db.tables, async () => {
        results = await runSequential(batch.operations, ctx)
        if (results.some((r) => !r.success)) throw new Error('Atomic batch aborted')
      })
      return { success: true, results }
    } catch {
      return { success: false, results }
    }
  }

  const results = await runSequential(batch.operations, ctx)
  return { success: results.every((r) => r.success), results }
}
