import type { ID, ISODateString } from '../types/common'
import type { Session } from '../types/session'
import type { TaskDef } from '../types/taskDef'
import { isQualifyingSession } from './qualifyingSession'
import { descendantsOf } from './taskTree'

export type BacklogSort = 'added' | 'active' | 'quiet'
export type BacklogGroup = 'none' | 'hobby' | 'skill'

export interface TaskActivity {
  /** Finished sessions that included the task or any of its subtasks. */
  sessions: number
  lastDate?: ISODateString
}

/** How much each task has been worked on; a parent counts its subtasks' sessions too. */
export function taskActivity(sessions: Session[], allTasks: TaskDef[], tasks: TaskDef[]): Map<ID, TaskActivity> {
  const finished = sessions.filter(isQualifyingSession)
  const result = new Map<ID, TaskActivity>()
  for (const task of tasks) {
    const ids = new Set([task.id, ...descendantsOf(allTasks, task.id).map((t) => t.id)])
    let count = 0
    let lastDate: ISODateString | undefined
    for (const s of finished) {
      if (!s.taskEntries.some((e) => e.taskDefId && ids.has(e.taskDefId))) continue
      count += 1
      if (!lastDate || s.dateKey > lastDate) lastDate = s.dateKey
    }
    result.set(task.id, { sessions: count, lastDate })
  }
  return result
}

/**
 * - added: newest first.
 * - active: most sessions first, then most recently worked on.
 * - quiet: the neglected first — never touched, then longest since last worked on.
 */
export function sortBacklog(tasks: TaskDef[], activity: Map<ID, TaskActivity>, mode: BacklogSort): TaskDef[] {
  const act = (t: TaskDef) => activity.get(t.id) ?? { sessions: 0 }
  const newest = (a: TaskDef, b: TaskDef) => b.createdAt.localeCompare(a.createdAt)
  return [...tasks].sort((a, b) => {
    if (mode === 'added') return newest(a, b)
    const x = act(a)
    const y = act(b)
    if (mode === 'active') {
      return y.sessions - x.sessions || (y.lastDate ?? '').localeCompare(x.lastDate ?? '') || newest(a, b)
    }
    return x.sessions - y.sessions || (x.lastDate ?? '').localeCompare(y.lastDate ?? '') || -newest(a, b)
  })
}

export interface BacklogSection {
  /** null for the untagged group. */
  id: ID | null
  name: string
  tasks: TaskDef[]
}

/**
 * Splits the (already sorted) backlog by hobby or skill. Tags are parallel,
 * so a task with two skills shows under both; untagged tasks go last.
 */
export function groupBacklog(
  tasks: TaskDef[],
  mode: BacklogGroup,
  tags: { id: ID; name: string }[],
): BacklogSection[] {
  if (mode === 'none') return [{ id: null, name: '', tasks }]
  const pick = (t: TaskDef) => (mode === 'hobby' ? t.hobbyIds : t.skillIds)
  const sections: BacklogSection[] = [...tags]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((tag) => ({ id: tag.id, name: tag.name, tasks: tasks.filter((t) => pick(t).includes(tag.id)) }))
    .filter((s) => s.tasks.length > 0)
  const known = new Set(tags.map((t) => t.id))
  const untagged = tasks.filter((t) => !pick(t).some((id) => known.has(id)))
  if (untagged.length > 0) sections.push({ id: null, name: mode === 'hobby' ? 'No hobby' : 'No skill', tasks: untagged })
  return sections
}
