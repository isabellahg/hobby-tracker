import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { ID } from '../types/common'
import type { ItemList } from '../types/list'
import type { ItemStatus, TaskDef } from '../types/taskDef'
import type { TaskActivity } from './backlogView'

export const STATUS_ORDER: ItemStatus[] = ['ongoing', 'want', 'paused', 'done', 'abandoned']
export const HABIT_STATUS_ORDER: ItemStatus[] = ['ongoing', 'want', 'paused', 'abandoned']

export function statusLabel(status: ItemStatus, habit = false): string {
  if (status === 'ongoing') return habit ? 'active' : 'ongoing'
  if (status === 'want') return 'want to'
  return status
}

/** Recurring tasks are habits; the backlog only lifts top-level ones out (subtasks stay with their parent). */
export function isHabit(task: TaskDef): boolean {
  return task.kind === 'recurring'
}

export function itemStatus(task: TaskDef): ItemStatus {
  return task.status ?? (isHabit(task) ? 'ongoing' : 'want')
}

export interface BacklogPartition {
  /** Active habits, for the backlog's habit strip. */
  habits: TaskDef[]
  /** Ongoing items, per list, in list order. */
  ongoing: { list: ItemList; tasks: TaskDef[] }[]
  /** The plain backlog: normal tasks plus list items you put there. */
  main: TaskDef[]
}

/**
 * Splits backlog roots into the special sections and the plain list. An item
 * whose list is archived (or gone) shows nowhere until the list is restored.
 */
export function partitionBacklog(roots: TaskDef[], lists: ItemList[]): BacklogPartition {
  const open = [...lists].filter((l) => !l.archived).sort((a, b) => a.order - b.order)
  const openIds = new Set(open.map((l) => l.id))
  const habits: TaskDef[] = []
  const main: TaskDef[] = []
  const ongoingById = new Map<ID, TaskDef[]>()
  for (const t of roots) {
    if (isHabit(t)) {
      if (itemStatus(t) === 'ongoing') habits.push(t)
      continue
    }
    if (!t.listId) {
      main.push(t)
      continue
    }
    if (!openIds.has(t.listId)) continue
    if (itemStatus(t) === 'ongoing') {
      ongoingById.set(t.listId, [...(ongoingById.get(t.listId) ?? []), t])
    } else if (t.inBacklog) {
      main.push(t)
    }
  }
  habits.sort((a, b) => a.label.localeCompare(b.label))
  const ongoing = open
    .filter((l) => ongoingById.has(l.id))
    .map((list) => ({ list, tasks: ongoingById.get(list.id)! }))
  return { habits, ongoing, main }
}

export const STALE_DAYS = 21

/**
 * Weeks an ongoing list item has sat untouched (no session, no status change),
 * or null while it's fresh. Shown as a short "quiet 4w" nudge.
 */
export function staleWeeks(task: TaskDef, activity: TaskActivity | undefined, now: Date): number | null {
  if (!task.listId || itemStatus(task) !== 'ongoing') return null
  const touched = [task.statusAt ?? task.createdAt, activity?.lastDate].filter(Boolean) as string[]
  const last = touched.sort().at(-1)!
  const days = differenceInCalendarDays(now, parseISO(last))
  return days >= STALE_DAYS ? Math.floor(days / 7) : null
}
