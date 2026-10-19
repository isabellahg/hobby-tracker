import { useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { run } from '../state/actions'
import { childProgress, childrenOf } from '../domain/logic/taskTree'
import type { TaskDef } from '../domain/types/taskDef'
import { InlineEdit } from './InlineEdit'
import { EnterForm } from './EnterForm'

/** `2/5` with a thin violet bar; nothing when there's nothing to count. */
export function ChildMeter({ done, total }: { done: number; total: number }) {
  if (total === 0) return null
  const pct = Math.round((done / total) * 100)
  return (
    <span className="mini-meter" title={`${done} of ${total} subtasks done`}>
      <span className="mini-bar">
        <span className="mini-bar-fill" style={{ width: `${pct}%` }} />
      </span>
      {done}/{total}
    </span>
  )
}

/** Enter adds a subtask and keeps focus, so splitting a task is a rapid-fire list. */
export function SubtaskQuickAdd({
  placeholder = 'subtask… ↵ to add, esc to close',
  onAdd,
  onClose,
}: {
  placeholder?: string
  onAdd: (label: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState('')
  return (
    <EnterForm
      onSubmit={() => {
        if (!draft.trim()) return
        onAdd(draft.trim())
        setDraft('')
      }}
    >
      <input
        type="text"
        className="subtask-input"
        autoFocus
        enterKeyHint="go"
        aria-label="New subtask"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        onBlur={() => !draft.trim() && onClose()}
      />
    </EnterForm>
  )
}

function addSubtask(parentId: string, label: string) {
  run({ operation: 'taskDef.create', payload: { label, parentId } })
}

interface SubtasksProps {
  task: TaskDef
  /** Every task, archived included, so closed subtasks still count as progress. */
  allTasks: TaskDef[]
  /** Extra props per row, e.g. making a subtask draggable into a bucket. */
  rowProps?: (task: TaskDef) => HTMLAttributes<HTMLLIElement>
  /** Trailing controls per row, e.g. the touch "→ add to…" picker. */
  rowExtras?: (task: TaskDef) => ReactNode
}

/**
 * A task's subtask tree plus the always-visible nudge to split it further.
 * Rows are plain tasks: rename inline, ✓ closes one (and anything under it).
 */
export function Subtasks({ task, allTasks, rowProps, rowExtras }: SubtasksProps) {
  const [open, setOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const openChildren = childrenOf(allTasks, task.id).filter((t) => !t.archived)
  const progress = childProgress(allTasks, task.id)
  const hasChildren = progress.total > 0 || openChildren.length > 0

  return (
    <div className="subtasks">
      <div className="row small">
        {hasChildren && (
          <button
            type="button"
            className="icon-btn"
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} subtasks of ${task.label}`}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '▾' : '▸'}
          </button>
        )}
        <ChildMeter {...progress} />
        {!adding && (
          <button type="button" className="split-link" onClick={() => { setAdding(true); setOpen(true) }}>
            {hasChildren ? '+ subtask' : '+ split into subtasks'}
          </button>
        )}
      </div>
      {open && (openChildren.length > 0 || adding) && (
        <ul className="subtree">
          {openChildren.map((child) => (
            <SubtaskRow key={child.id} task={child} allTasks={allTasks} rowProps={rowProps} rowExtras={rowExtras} />
          ))}
          {adding && (
            <li>
              <SubtaskQuickAdd onAdd={(label) => addSubtask(task.id, label)} onClose={() => setAdding(false)} />
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function SubtaskRow({ task, allTasks, rowProps, rowExtras }: SubtasksProps) {
  const [adding, setAdding] = useState(false)
  const openChildren = childrenOf(allTasks, task.id).filter((t) => !t.archived)
  const progress = childProgress(allTasks, task.id)
  return (
    <li {...rowProps?.(task)}>
      <div className="subtask-row">
        <span className={`dot ${task.kind === 'recurring' ? 'dot-amber' : 'dot-violet'}`} />
        <InlineEdit
          value={task.label}
          ariaLabel={`Rename ${task.label}`}
          className="grow"
          onSave={(label) => run({ operation: 'taskDef.update', payload: { id: task.id, label } })}
        />
        <ChildMeter {...progress} />
        {rowExtras?.(task)}
        <button
          type="button"
          className="icon-btn"
          title="Split into subtasks"
          aria-label={`Add a subtask to ${task.label}`}
          onClick={() => setAdding(true)}
        >
          +
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Done (closes its subtasks too)"
          aria-label={`Mark ${task.label} done`}
          onClick={() => run({ operation: 'taskDef.archive', payload: { id: task.id, archived: true } })}
        >
          ✓
        </button>
      </div>
      {(openChildren.length > 0 || adding) && (
        <ul className="subtree">
          {openChildren.map((child) => (
            <SubtaskRow key={child.id} task={child} allTasks={allTasks} rowProps={rowProps} rowExtras={rowExtras} />
          ))}
          {adding && (
            <li>
              <SubtaskQuickAdd onAdd={(label) => addSubtask(task.id, label)} onClose={() => setAdding(false)} />
            </li>
          )}
        </ul>
      )}
    </li>
  )
}
