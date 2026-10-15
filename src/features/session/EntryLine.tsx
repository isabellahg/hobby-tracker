import type { SessionTaskEntry } from '../../domain/types/session'

/**
 * One line of a finished session's task list. A subtask names its parent
 * ("Parent › Child") and a parent counts its subtasks, all from the session's
 * own snapshot so later edits never rewrite history.
 */
export function EntryLine({ entry, entries }: { entry: SessionTaskEntry; entries: SessionTaskEntry[] }) {
  const parent = entry.parentEntryId ? entries.find((e) => e.id === entry.parentEntryId) : undefined
  const children = entries.filter((e) => e.parentEntryId === entry.id && e.status !== 'skipped')
  const done = children.filter((e) => e.status === 'completed').length
  return (
    <>
      {parent && <span className="muted">{parent.label} › </span>}
      {entry.label}
      {children.length > 0 && (
        <span className="muted small">
          {' '}
          · {done}/{children.length} subtasks
        </span>
      )}
    </>
  )
}
