import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { EmptyState } from '../../components/EmptyState'
import { EnterForm } from '../../components/EnterForm'
import { MediaList, MediaStrip } from '../../components/MediaStrip'
import { usePendingAttachments } from '../../components/usePendingAttachments'
import { TaskEditor } from '../../components/TaskEditor'
import { FrequencyEditor, HabitMeter, StaleNudge, StatusSelect } from '../../components/ListBits'
import { taskActivity } from '../../domain/logic/backlogView'
import { habitProgress } from '../../domain/logic/habits'
import { HABIT_STATUS_ORDER, itemStatus, STATUS_ORDER, staleWeeks, statusLabel } from '../../domain/logic/listItems'
import { isTreeRoot } from '../../domain/logic/taskTree'
import type { ItemStatus, TaskDef } from '../../domain/types/taskDef'

/** `/lists/:id` — keyed so switching lists starts fresh (no half-typed item carried over). */
export function ListRoute() {
  const { id } = useParams()
  return <ListScreen key={id} />
}

/** Groups that start folded: the finished-with pile. */
const FOLDED: ItemStatus[] = ['done', 'abandoned']

/**
 * One list's page — a user list (`/lists/:id`) or the built-in Habits list
 * (`/habits`). Items are tasks that stay out of the backlog unless ongoing or
 * explicitly put there.
 */
export function ListScreen({ habits = false }: { habits?: boolean }) {
  const { id } = useParams()
  const lists = useAppStore((s) => s.lists)
  const allTaskDefs = useAppStore((s) => s.taskDefs)
  const sessions = useAppStore((s) => s.sessions)
  const list = habits ? undefined : lists.find((l) => l.id === id)

  const [label, setLabel] = useState('')
  const pending = usePendingAttachments((title) => setLabel((l) => (l.trim() ? l : title)))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [now] = useState(() => new Date())

  if (!habits && !list) return <EmptyState>That list doesn't exist.</EmptyState>

  const open = allTaskDefs.filter((t) => !t.archived)
  const openIds = new Set(open.map((t) => t.id))
  const items = open.filter(
    (t) => isTreeRoot(t, openIds) && (habits ? t.kind === 'recurring' : t.listId === list!.id),
  )
  const activity = taskActivity(sessions, allTaskDefs, items)
  const order = habits ? HABIT_STATUS_ORDER : STATUS_ORDER
  const groups = order
    .map((status) => ({
      status,
      items: items.filter((t) => itemStatus(t) === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }))
    .filter((g) => g.items.length > 0)

  async function add() {
    const name = label.trim() || pending.fallbackLabel()
    if (!name) return
    const result = await run({
      operation: 'taskDef.create',
      payload: habits ? { label: name, kind: 'recurring' } : { label: name, listId: list!.id },
    })
    if (result.success) pending.saveTo(result.changes[0].id)
    setLabel('')
  }

  function row(task: TaskDef) {
    if (editingId === task.id) {
      return (
        <div key={task.id} className="card card-tight">
          <TaskEditor task={task} onDone={() => setEditingId(null)} />
        </div>
      )
    }
    const weeks = staleWeeks(task, activity.get(task.id), now)
    return (
      <div key={task.id} className={`card card-tight list-item status-${itemStatus(task)}`}>
        <div className="row row-between row-top">
          <div className="grow stack stack-xs">
            <span className="strong">{task.label}</span>
            <div className="row wrap small">
              {habits && <HabitMeter progress={habitProgress(task, sessions, now)} />}
              {weeks !== null && <StaleNudge task={task} weeks={weeks} />}
              {task.inBacklog && <span className="list-row-meta">in backlog</span>}
            </div>
          </div>
          <div className="row">
            <StatusSelect task={task} />
            {!habits && (
              <button
                type="button"
                className="icon-btn"
                aria-pressed={!!task.inBacklog}
                title={task.inBacklog ? 'Take it out of the backlog (stays on this list)' : 'Also put it in the backlog'}
                aria-label={task.inBacklog ? `Take ${task.label} out of the backlog` : `Put ${task.label} in the backlog`}
                onClick={() => run({ operation: 'taskDef.update', payload: { id: task.id, inBacklog: !task.inBacklog } })}
              >
                {task.inBacklog ? '☰✓' : '+☰'}
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label={`Edit ${task.label}`}
              title="Edit, add pictures or links"
              onClick={() => setEditingId(task.id)}
            >
              ✎
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Delete ${task.label}`}
              title="Delete (restore it from the Task Library)"
              onClick={() => run({ operation: 'taskDef.archive', payload: { id: task.id, archived: true } })}
            >
              ×
            </button>
          </div>
        </div>
        {habits && <FrequencyEditor task={task} />}
        <MediaStrip taskDefId={task.id} />
      </div>
    )
  }

  const title = habits ? 'Habits' : list!.name
  return (
    <div className="stack">
      <div className="page-header">
        <h2>{title}</h2>
        <span className="muted small">
          {items.length} item{items.length === 1 ? '' : 's'}
          {list?.archived && ' · archived'}
        </span>
      </div>
      <p className="desc m0">
        {habits
          ? 'Things you keep doing. Active ones sit in the backlog’s habit strip; each is rated against its min / avg / amazing.'
          : 'Ongoing items show up in the backlog on their own; anything else stays here until you put it there.'}
      </p>

      <EnterForm className="row" onSubmit={add}>
        <div className="field grow m0" onPaste={pending.onPaste}>
          <input
            type="text"
            enterKeyHint="go"
            aria-label={`Add to ${title}`}
            placeholder={habits ? 'New habit, e.g. Scales' : 'Add something — or paste a link'}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <MediaList items={pending.items} onRemove={pending.remove} />
          {pending.loading && <span className="field-hint">Fetching preview…</span>}
        </div>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </EnterForm>

      {items.length === 0 && <EmptyState>Nothing here yet.</EmptyState>}

      {groups.map((g) => {
        const heading = (
          <>
            <span className={`dot status-dot-${g.status}`} />
            {statusLabel(g.status, habits)}
            <span className="panel-count">({g.items.length})</span>
          </>
        )
        return FOLDED.includes(g.status) ? (
          <details key={g.status} className="list-group">
            <summary className="backlog-group">{heading}</summary>
            <div className="stack stack-sm">{g.items.map(row)}</div>
          </details>
        ) : (
          <section key={g.status} className="list-group">
            <div className="backlog-group">{heading}</div>
            <div className="stack stack-sm">{g.items.map(row)}</div>
          </section>
        )
      })}
    </div>
  )
}
