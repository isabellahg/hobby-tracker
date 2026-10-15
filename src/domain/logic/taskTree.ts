import type { ID } from '../types/common'
import type { TaskDef } from '../types/taskDef'

/** Direct children of a task, oldest first (subtasks have no manual order). */
export function childrenOf(taskDefs: TaskDef[], id: ID): TaskDef[] {
  return taskDefs
    .filter((t) => t.parentId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Every task below `id`, depth-first, in display order. */
export function descendantsOf(taskDefs: TaskDef[], id: ID): TaskDef[] {
  const out: TaskDef[] = []
  const visit = (parentId: ID, seen: Set<ID>) => {
    for (const child of childrenOf(taskDefs, parentId)) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      out.push(child)
      visit(child.id, seen)
    }
  }
  visit(id, new Set([id]))
  return out
}

/** True when making `newParentId` the parent of `id` would loop back on itself. */
export function wouldCreateCycle(taskDefs: TaskDef[], id: ID, newParentId: ID): boolean {
  if (id === newParentId) return true
  return descendantsOf(taskDefs, id).some((t) => t.id === newParentId)
}

/**
 * Closed (archived) children over all children. Recurring children never
 * close on their own, so they count on neither side.
 */
export function childProgress(taskDefs: TaskDef[], id: ID): { done: number; total: number } {
  const children = childrenOf(taskDefs, id).filter((t) => t.kind !== 'recurring')
  return { done: children.filter((t) => t.archived).length, total: children.length }
}

/** Tasks shown at the top of a tree: no parent, or a parent that's gone/closed. */
export function isTreeRoot(task: TaskDef, openIds: Set<ID>): boolean {
  return !task.parentId || !openIds.has(task.parentId)
}
