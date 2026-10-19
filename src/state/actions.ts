import { applyBatch, applyOperation } from '../domain/operations/registry'
import { makeContext, type OperationContext } from '../domain/operations/context'
import type {
  ChangedRecord,
  OperationRequest,
  OperationResult,
  OperationBatchRequest,
  OperationBatchResult,
} from '../domain/operations/envelope'
import { useAppStore, type AppState } from './store'

type ListKey = Extract<
  keyof AppState,
  | 'hobbies'
  | 'skills'
  | 'taskDefs'
  | 'routines'
  | 'sessions'
  | 'personalRecords'
  | 'planBuckets'
  | 'taskMedia'
>

const STORE_TO_LIST_KEY: Record<string, ListKey> = {
  hobbies: 'hobbies',
  skills: 'skills',
  taskDefs: 'taskDefs',
  routines: 'routines',
  sessions: 'sessions',
  personalRecords: 'personalRecords',
  planBuckets: 'planBuckets',
  taskMedia: 'taskMedia',
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id)
  if (index === -1) return [...list, item]
  const copy = [...list]
  copy[index] = item
  return copy
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id)
}

/** Patches the in-memory Zustand mirror from a set of applied changes — the only place the store is written from outside React. */
export function applyChangesToStore(changes: ChangedRecord[]): void {
  if (changes.length === 0) return
  useAppStore.setState((state) => {
    let next: Partial<AppState> = {}
    for (const change of changes) {
      if (change.store === 'weeklyPlan') {
        if (change.after) next = { ...next, weeklyPlan: change.after as AppState['weeklyPlan'] }
        continue
      }
      const key = STORE_TO_LIST_KEY[change.store]
      if (!key) continue
      const currentList = (next[key] as { id: string }[] | undefined) ?? (state[key] as { id: string }[])
      const updatedList =
        change.changeType === 'deleted'
          ? removeById(currentList, change.id)
          : upsert(currentList, change.after as { id: string })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(next as any)[key] = updatedList
    }
    return next
  })
}

/**
 * Operations are read-modify-write (e.g. a toggle reads the session, then
 * writes it back), so two fired together — like ticking two tasks quickly —
 * would each start from the same old record and the second would erase the
 * first. Queue them so each sees the previous one's result.
 */
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task)
  queue = next.catch(() => undefined)
  return next
}

/** The single entry point for every mutation — used identically by UI components and the LLM Import screen. */
export function run(req: OperationRequest, ctxOverrides: Partial<OperationContext> = {}): Promise<OperationResult> {
  return enqueue(async () => {
    const ctx = makeContext(ctxOverrides)
    const result = await applyOperation(req, ctx)
    if (result.success && !ctx.dryRun) applyChangesToStore(result.changes)
    return result
  })
}

export function runBatch(
  batch: OperationBatchRequest,
  ctxOverrides: Partial<OperationContext> = {},
): Promise<OperationBatchResult> {
  return enqueue(async () => {
    const ctx = makeContext(ctxOverrides)
    const result = await applyBatch(batch, ctx)
    if (!ctx.dryRun) {
      for (const r of result.results) if (r.success) applyChangesToStore(r.changes)
    }
    return result
  })
}
