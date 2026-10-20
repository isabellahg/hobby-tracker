import { Fragment, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { countSessionsForTask } from '../../domain/logic/taskProgress'
import { childProgress, descendantsOf, isTreeRoot } from '../../domain/logic/taskTree'
import { getDayOfWeek } from '../../domain/logic/weekUtils'
import {
  groupBacklog,
  sortBacklog,
  taskActivity,
  type BacklogGroup,
  type BacklogSort,
} from '../../domain/logic/backlogView'
import { useStoredState } from '../../components/useStoredState'
import { TaskTagPicker } from '../../components/TaskTagPicker'
import { kindLabel as kindName } from '../../components/taskKinds'
import { TaskEditor } from '../../components/TaskEditor'
import { InlineEdit } from '../../components/InlineEdit'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Chip } from '../../components/Chip'
import { Panel } from '../../components/Panel'
import { EnterForm } from '../../components/EnterForm'
import { MediaList } from '../../components/MediaStrip'
import { usePendingAttachments } from '../../components/usePendingAttachments'
import { MediaStrip } from '../../components/MediaStrip'
import { ChildMeter, Subtasks } from '../../components/Subtasks'
import { HabitMeter, StaleNudge } from '../../components/ListBits'
import { partitionBacklog, staleWeeks } from '../../domain/logic/listItems'
import { habitProgress } from '../../domain/logic/habits'
import type { PlanBucket } from '../../domain/types/planBucket'
import type { Routine } from '../../domain/types/routine'
import type { Session } from '../../domain/types/session'
import type { TaskDef, TaskKind } from '../../domain/types/taskDef'
import { sessionTitle } from '../session/sessionTitle'
import { allowDrop, readDragPayload, startDrag, type DragPayload } from './drag'
import { loggableSessions, logCompleted, sessionWhen } from './logCompleted'
import { TaskContextMenu, type MenuAnchor } from './TaskContextMenu'

/** Somewhere a backlog task can be sent. */
type Target =
  | { type: 'bucket'; id: string }
  | { type: 'routine'; id: string }
  | { type: 'session'; id: string }
  /** Log as already completed in a (usually finished) session. */
  | { type: 'done'; id: string }

function kindLabel(kind: TaskKind): string {
  return kindName(kind).toLowerCase()
}


const NEXT_SORT: Record<BacklogSort, BacklogSort> = { added: 'active', active: 'quiet', quiet: 'added' }
const SORT_LABEL: Record<BacklogSort, string> = { added: 'newest', active: 'most active', quiet: 'least active' }
const NEXT_GROUP: Record<BacklogGroup, BacklogGroup> = { none: 'hobby', hobby: 'skill', skill: 'none' }
const GROUP_LABEL: Record<BacklogGroup, string> = { none: 'no groups', hobby: 'by hobby', skill: 'by skill' }

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)}/${Number(m)}`
}

/**
 * Home's working area, as two independently scrolling columns: the backlog,
 * and everything you can start — sessions in progress, routines, and
 * planning sessions — each a drop target for backlog tasks.
 */
export function PlanningBoard() {
  const navigate = useNavigate()
  const allTaskDefs = useAppStore((s) => s.taskDefs)
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const buckets = useAppStore((s) => s.planBuckets)
  const sessions = useAppStore((s) => s.sessions)
  const allRoutines = useAppStore((s) => s.routines)
  const plan = useAppStore((s) => s.weeklyPlan)
  const lists = useAppStore((s) => s.lists)

  const taskDefs = allTaskDefs.filter((t) => !t.archived)
  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((sk) => !sk.archived)
  const taskDefById = new Map(taskDefs.map((t) => [t.id, t]))
  const openIds = new Set(taskDefById.keys())
  const rootTasks = taskDefs.filter((t) => isTreeRoot(t, openIds))
  const hobbyById = new Map(allHobbies.map((h) => [h.id, h]))
  const skillById = new Map(allSkills.map((s) => [s.id, s]))
  const running = sessions.filter((s) => s.state === 'in_progress')

  const [now] = useState(() => new Date())
  const todayDow = getDayOfWeek(now)
  const plannedToday = new Set(plan.assignments[todayDow] ?? [])
  const routines = allRoutines
    .filter((r) => !r.archived)
    .sort((a, b) => Number(plannedToday.has(b.id)) - Number(plannedToday.has(a.id)) || a.name.localeCompare(b.name))

  const [label, setLabel] = useState('')
  const [hobbyIds, setHobbyIds] = useState<string[]>([])
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [kind, setKind] = useState<TaskKind>('once')
  const pending = usePendingAttachments((title) => setLabel((l) => (l.trim() ? l : title)))
  const [newBucketName, setNewBucketName] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [finishingTask, setFinishingTask] = useState<TaskDef | null>(null)
  const [view, setView] = useStoredState('hobby-tracker.backlog-view', {
    sort: 'added' as BacklogSort,
    group: 'none' as BacklogGroup,
    compact: false,
  })
  // In compact mode, the one row opened up into a full card.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const recentFinished = loggableSessions(sessions, 5).filter((s) => s.state === 'finished')

  /** Right-click (long-press on a phone) a task: "Completed on ›". */
  function openMenu(task: TaskDef) {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setMenu({ taskDefId: task.id, x: e.clientX, y: e.clientY })
    }
  }

  const activity = taskActivity(sessions, allTaskDefs, rootTasks)
  // Habits and ongoing list items get their own strips; the rest is the plain backlog.
  const partition = partitionBacklog(rootTasks, lists)
  const listById = new Map(lists.map((l) => [l.id, l]))
  const sections = groupBacklog(
    sortBacklog(partition.main, activity, view.sort),
    view.group,
    view.group === 'hobby' ? hobbies : skills,
  )

  function toggleHobby(id: string) {
    setHobbyIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }
  function toggleSkill(id: string) {
    setSkillIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  async function addToBacklog() {
    const name = label.trim() || pending.fallbackLabel()
    if (!name) return
    const result = await run({
      operation: 'taskDef.create',
      payload: { label: name, hobbyIds, skillIds, kind },
    })
    if (result.success) pending.saveTo(result.changes[0].id)
    setLabel('')
    setHobbyIds([])
    setSkillIds([])
    setKind('once')
  }

  async function createBucket() {
    if (!newBucketName.trim()) return
    await run({ operation: 'bucket.create', payload: { name: newBucketName.trim() } })
    setNewBucketName('')
  }

  async function startBucket(bucketId: string) {
    const result = await run({ operation: 'session.startFromBucket', payload: { bucketId } })
    if (result.success && result.changes[0]) navigate(`/session/${result.changes[0].id}`)
  }

  async function startRoutine(routineId: string) {
    const result = await run({ operation: 'session.start', payload: { routineId } })
    if (result.success && result.changes[0]) navigate(`/session/${result.changes[0].id}`)
  }

  async function finishTask(task: TaskDef) {
    await run({ operation: 'taskDef.finish', payload: { id: task.id } })
    setFinishingTask(null)
  }

  /** Sends a task to a target; when it came out of a planning session, it leaves that one. */
  function sendTask(payload: DragPayload, target: Target) {
    if (target.type === 'done') {
      // Logging is a record of the past, not a move: the task stays where it is.
      const session = sessions.find((x) => x.id === target.id)
      if (session) logCompleted(payload.taskDefId, session)
      return
    }
    if (target.type === 'bucket' && payload.sourceBucketId === target.id) return
    if (payload.sourceBucketId) {
      run({ operation: 'bucket.removeTask', payload: { bucketId: payload.sourceBucketId, taskDefId: payload.taskDefId } })
    }
    if (target.type === 'bucket') {
      run({ operation: 'bucket.addTask', payload: { bucketId: target.id, taskDefId: payload.taskDefId } })
    } else if (target.type === 'routine') {
      run({ operation: 'routine.addExtraTask', payload: { routineId: target.id, taskDefId: payload.taskDefId } })
    } else {
      run({ operation: 'session.addTask', payload: { sessionId: target.id, taskDefId: payload.taskDefId } })
    }
  }

  function dropOn(target: Target) {
    return (e: React.DragEvent) => {
      e.preventDefault()
      const payload = readDragPayload(e)
      if (payload) sendTask(payload, target)
    }
  }

  function reorderWithinBucket(bucket: PlanBucket, draggedTaskDefId: string, beforeTaskDefId: string) {
    const currentIds = [...bucket.taskRefs].sort((a, b) => a.order - b.order).map((r) => r.taskDefId)
    const withoutDragged = currentIds.filter((id) => id !== draggedTaskDefId)
    const insertAt = withoutDragged.indexOf(beforeTaskDefId)
    withoutDragged.splice(insertAt, 0, draggedTaskDefId)
    run({ operation: 'bucket.reorderTasks', payload: { bucketId: bucket.id, orderedTaskDefIds: withoutDragged } })
  }

  function handleDropOnBucketTask(e: React.DragEvent, bucket: PlanBucket, targetTaskDefId: string) {
    e.preventDefault()
    e.stopPropagation()
    const payload = readDragPayload(e)
    if (!payload) return
    if (payload.sourceBucketId === bucket.id) {
      if (payload.taskDefId !== targetTaskDefId) reorderWithinBucket(bucket, payload.taskDefId, targetTaskDefId)
      return
    }
    sendTask(payload, { type: 'bucket', id: bucket.id })
  }

  function handleDropOnBacklog(e: React.DragEvent) {
    e.preventDefault()
    const payload = readDragPayload(e)
    if (!payload || !payload.sourceBucketId) return
    run({
      operation: 'bucket.removeTask',
      payload: { bucketId: payload.sourceBucketId, taskDefId: payload.taskDefId },
    })
  }

  function tagChips(task: TaskDef) {
    return (
      <>
        <Chip>{kindLabel(task.kind)}</Chip>
        {task.hobbyIds.map((id) => (
          <Chip key={id} tone="hobby">
            {hobbyById.get(id)?.name ?? '?'}
          </Chip>
        ))}
        {task.skillIds.map((id) => (
          <Chip key={id} tone="skill">
            {skillById.get(id)?.name ?? '?'}
          </Chip>
        ))}
      </>
    )
  }

  /** Touch screens have no native drag-and-drop, so offer a picker of every target instead. */
  function targetPicker(task: TaskDef) {
    if (running.length + routines.length + buckets.length + recentFinished.length === 0) return null
    return (
      <select
        className="touch-only bucket-picker"
        aria-label={`Send ${task.label} to…`}
        value=""
        onChange={(e) => {
          const [type, id] = e.target.value.split(':') as [Target['type'], string]
          if (id) sendTask({ taskDefId: task.id, sourceBucketId: null }, { type, id } as Target)
        }}
      >
        <option value="">→ add to…</option>
        {running.length > 0 && (
          <optgroup label="In progress">
            {running.map((s) => (
              <option key={s.id} value={`session:${s.id}`}>
                {sessionTitle(s, allRoutines)}
              </option>
            ))}
          </optgroup>
        )}
        {routines.length > 0 && (
          <optgroup label="Routine (next run only)">
            {routines.map((r) => (
              <option key={r.id} value={`routine:${r.id}`}>
                {r.name}
              </option>
            ))}
          </optgroup>
        )}
        {buckets.length > 0 && (
          <optgroup label="Planning sessions">
            {buckets.map((b) => (
              <option key={b.id} value={`bucket:${b.id}`}>
                {b.name}
              </option>
            ))}
          </optgroup>
        )}
        {recentFinished.length > 0 && (
          <optgroup label="Already done in…">
            {recentFinished.map((s) => (
              <option key={s.id} value={`done:${s.id}`}>
                ✓ {sessionTitle(s, allRoutines)} · {sessionWhen(s)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    )
  }

  function backlogCard(task: TaskDef) {
    if (editingTaskId === task.id) {
      return (
        <div key={task.id} className="card card-tight">
          <TaskEditor task={task} onDone={() => setEditingTaskId(null)} />
        </div>
      )
    }
    const sessionCount = task.kind === 'ongoing' ? countSessionsForTask(sessions, task.id) : 0
    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => startDrag(e, { taskDefId: task.id, sourceBucketId: null })}
        onContextMenu={openMenu(task)}
        className="card card-tight card-draggable stack stack-sm"
      >
        <div className="row row-between">
          <span className="strong">{task.label}</span>
          <div className="row">
            {task.listId && removeFromBacklogButton(task)}
            {task.kind === 'ongoing' && !task.listId && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Mark ${task.label} finished`}
                title="Mark finished"
                onClick={() => setFinishingTask(task)}
              >
                ✓
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label={`Edit ${task.label}`}
              title="Edit, add pictures or links"
              onClick={() => setEditingTaskId(task.id)}
            >
              ✎
            </button>
            {view.compact && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Collapse ${task.label}`}
                title="Collapse"
                onClick={() => setExpandedId(null)}
              >
                ▴
              </button>
            )}
          </div>
        </div>
        <div className="row wrap">
          {fromListChip(task)}
          {tagChips(task)}
          {task.kind === 'ongoing' && (
            <span className="list-row-meta">
              ×{sessionCount} session{sessionCount === 1 ? '' : 's'}
            </span>
          )}
          {task.kind !== 'ongoing' && view.sort !== 'added' && activityMeta(task)}
        </div>
        <MediaStrip taskDefId={task.id} />
        {targetPicker(task)}
        <Subtasks
          task={task}
          allTasks={allTaskDefs}
          rowProps={(sub) => ({
            draggable: true,
            className: 'card-draggable',
            onDragStart: (e) => {
              // Don't let the parent card's handler overwrite which task is dragged.
              e.stopPropagation()
              startDrag(e, { taskDefId: sub.id, sourceBucketId: null })
            },
            onContextMenu: openMenu(sub),
          })}
          rowExtras={targetPicker}
        />
        {task.kind === 'ongoing' && (
          <div className="row small">
            <span className="muted">next:</span>
            <InlineEdit
              value={task.nextAction ?? ''}
              placeholder="set a next action"
              ariaLabel={`Next action for ${task.label}`}
              onSave={(nextAction) => run({ operation: 'taskDef.update', payload: { id: task.id, nextAction } })}
            />
          </div>
        )}
      </div>
    )
  }

  function fromListChip(task: TaskDef) {
    const list = task.listId ? listById.get(task.listId) : undefined
    if (!list) return null
    return (
      <Link to={`/lists/${list.id}`} className="chip chip-list" title={`From your ${list.name} list`}>
        ▤ {list.name}
      </Link>
    )
  }

  function removeFromBacklogButton(task: TaskDef) {
    return (
      <button
        type="button"
        className="icon-btn"
        aria-label={`Take ${task.label} out of the backlog`}
        title="Take out of the backlog — it stays on its list"
        onClick={() => run({ operation: 'taskDef.update', payload: { id: task.id, inBacklog: false } })}
      >
        ×
      </button>
    )
  }

  function editingCard(task: TaskDef) {
    return (
      <div key={task.id} className="card card-tight">
        <TaskEditor task={task} onDone={() => setEditingTaskId(null)} />
      </div>
    )
  }

  /** Active habits: one line each, with how this period is going. */
  function habitStrip() {
    if (partition.habits.length === 0) return null
    return (
      <div className="backlog-special special-habits">
        <div className="backlog-group">
          <span className="dot dot-amber" />
          <Link to="/habits">Habits</Link>
          <span className="panel-count">({partition.habits.length})</span>
        </div>
        {partition.habits.map((habit) =>
          editingTaskId === habit.id ? (
            editingCard(habit)
          ) : (
            <div
              key={habit.id}
              draggable
              onDragStart={(e) => startDrag(e, { taskDefId: habit.id, sourceBucketId: null })}
              onContextMenu={openMenu(habit)}
              className="habit-row card-draggable"
            >
              <span className="habit-row-label" title={habit.label}>
                {habit.label}
              </span>
              <HabitMeter progress={habitProgress(habit, sessions, now)} />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Edit ${habit.label}`}
                title="Edit"
                onClick={() => setEditingTaskId(habit.id)}
              >
                ✎
              </button>
              {targetPicker(habit)}
            </div>
          ),
        )}
      </div>
    )
  }

  /** What you're in the middle of on each list — bookmark-style cards. */
  function ongoingStrips() {
    return partition.ongoing.map(({ list, tasks }) => (
      <div key={list.id} className="backlog-special special-list">
        <div className="backlog-group">
          <span className="dot dot-violet" />
          <Link to={`/lists/${list.id}`}>{list.name}</Link>
          <span className="muted">· ongoing</span>
          <span className="panel-count">({tasks.length})</span>
        </div>
        {tasks.map((task) => {
          if (editingTaskId === task.id) return editingCard(task)
          const weeks = staleWeeks(task, activity.get(task.id), now)
          return (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => startDrag(e, { taskDefId: task.id, sourceBucketId: null })}
              onContextMenu={openMenu(task)}
              className="bookmark-card card-draggable"
            >
              <div className="row row-between">
                <span className="strong">{task.label}</span>
                <div className="row">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Mark ${task.label} done`}
                    title="Done — it stays on the list under Done"
                    onClick={() => run({ operation: 'taskDef.setStatus', payload: { id: task.id, status: 'done' } })}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Edit ${task.label}`}
                    title="Edit"
                    onClick={() => setEditingTaskId(task.id)}
                  >
                    ✎
                  </button>
                </div>
              </div>
              <div className="row wrap small">
                {task.statusAt && <span className="list-row-meta">since {shortDate(task.statusAt.slice(0, 10))}</span>}
                {weeks !== null && <StaleNudge task={task} weeks={weeks} />}
                {(activity.get(task.id)?.sessions ?? 0) > 0 && (
                  <span className="list-row-meta">×{activity.get(task.id)!.sessions}</span>
                )}
              </div>
              <MediaStrip taskDefId={task.id} />
              {targetPicker(task)}
            </div>
          )
        })}
      </div>
    ))
  }

  function activityMeta(task: TaskDef) {
    const a = activity.get(task.id)
    if (!a || a.sessions === 0) return <span className="list-row-meta">never done</span>
    return (
      <span className="list-row-meta" title={`${a.sessions} session${a.sessions === 1 ? '' : 's'}, last on ${a.lastDate}`}>
        ×{a.sessions} · {shortDate(a.lastDate!)}
      </span>
    )
  }

  /** Compact mode: one draggable line per task; tap the name to open the full card. */
  function backlogLine(task: TaskDef) {
    const progress = childProgress(allTaskDefs, task.id)
    const a = activity.get(task.id)
    return (
      <div
        draggable
        onDragStart={(e) => startDrag(e, { taskDefId: task.id, sourceBucketId: null })}
        onContextMenu={openMenu(task)}
        className="backlog-line card-draggable"
      >
        <span className={`kind-dot kind-${task.kind}`} title={kindName(task.kind)} />
        <button
          type="button"
          className="backlog-line-label"
          title={`${task.label} — tap to open`}
          onClick={() => setExpandedId(task.id)}
        >
          {task.label}
        </button>
        <ChildMeter done={progress.done} total={progress.total} />
        {a && a.sessions > 0 && <span className="backlog-line-meta">×{a.sessions}</span>}
        {task.listId && <span className="backlog-line-meta" title={listById.get(task.listId)?.name}>▤</span>}
        <button
          type="button"
          className="icon-btn"
          aria-label={`Edit ${task.label}`}
          title="Edit"
          onClick={() => setEditingTaskId(task.id)}
        >
          ✎
        </button>
      </div>
    )
  }

  function backlogItem(task: TaskDef) {
    const full = !view.compact || expandedId === task.id || editingTaskId === task.id
    return full ? backlogCard(task) : backlogLine(task)
  }

  function bucketCard(task: TaskDef, bucket: PlanBucket) {
    const openSubtaskCount = descendantsOf(taskDefs, task.id).length
    return (
      <div
        draggable
        onDragStart={(e) => startDrag(e, { taskDefId: task.id, sourceBucketId: bucket.id })}
        onContextMenu={openMenu(task)}
        className="card card-tight card-draggable"
      >
        <div className="row row-between">
          <span>{task.label}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove ${task.label} from ${bucket.name}`}
            title="Remove from this session"
            onClick={() =>
              run({ operation: 'bucket.removeTask', payload: { bucketId: bucket.id, taskDefId: task.id } })
            }
          >
            ×
          </button>
        </div>
        <div className="row wrap">
          {tagChips(task)}
          <ChildMeter {...childProgress(allTaskDefs, task.id)} />
          {openSubtaskCount > 0 && (
            <span className="list-row-meta" title="Open subtasks come along when the session starts">
              +{openSubtaskCount} subtask{openSubtaskCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    )
  }

  function runningPanel(session: Session) {
    const top = session.taskEntries.filter((e) => !e.parentEntryId)
    const done = session.taskEntries.filter((e) => e.status === 'completed').length
    return (
      <Panel
        key={session.id}
        className="panel-running"
        icon="●"
        title={sessionTitle(session, allRoutines)}
        count={session.taskEntries.length}
        description="In progress. Drop a task here to add it now."
        actions={
          <Link to={`/session/${session.id}`} className="btn btn-primary">
            Open
          </Link>
        }
        onDragOver={allowDrop}
        onDrop={dropOn({ type: 'session', id: session.id })}
      >
        <ul className="list-plain drop-zone">
          {top.map((e) => (
            <li key={e.id} className="list-row">
              <span className={e.status === 'completed' ? 'dot dot-success' : 'dot'} />
              <span className={e.status === 'completed' ? 'grow is-done' : 'grow'}>{e.label}</span>
            </li>
          ))}
          {top.length === 0 && <li className="empty-hint">Nothing yet.</li>}
        </ul>
        <p className="list-row-meta m0">
          {done}/{session.taskEntries.length} done
        </p>
      </Panel>
    )
  }

  function routinePanel(routine: Routine) {
    const own = [...routine.taskRefs].sort((a, b) => a.order - b.order)
    const extras = [...(routine.extraTaskRefs ?? [])].sort((a, b) => a.order - b.order)
    const isToday = plannedToday.has(routine.id)
    return (
      <Panel
        key={routine.id}
        icon="↻"
        title={routine.name}
        count={own.length + extras.length}
        actions={
          <>
            {isToday && <Chip tone="hobby">today</Chip>}
            <Link to={`/routines/${routine.id}`} className="icon-btn" aria-label={`Edit ${routine.name}`} title="Edit routine">
              ✎
            </Link>
          </>
        }
        onDragOver={allowDrop}
        onDrop={dropOn({ type: 'routine', id: routine.id })}
      >
        <ul className="list-plain drop-zone">
          {own.map((ref) => (
            <li key={ref.id} className="list-row">
              <span className="dot dot-violet" />
              <span className="grow">{taskDefById.get(ref.taskDefId)?.label ?? '(archived task)'}</span>
            </li>
          ))}
          {own.length === 0 && extras.length === 0 && <li className="empty-hint">No tasks yet.</li>}
        </ul>
        {extras.length > 0 && (
          <>
            <p className="section-title m0">This run only</p>
            <ul className="list-plain">
              {extras.map((ref) => {
                const task = taskDefById.get(ref.taskDefId)
                return (
                  <li key={ref.id} className="list-row">
                    <span className="dot dot-amber" />
                    <span className="grow">{task?.label ?? '(archived task)'}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Keep it in this routine for good"
                      aria-label={`Keep ${task?.label} in ${routine.name}`}
                      onClick={() =>
                        run({ operation: 'routine.keepExtraTask', payload: { routineId: routine.id, taskDefId: ref.taskDefId } })
                      }
                    >
                      📌
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Remove from this run"
                      aria-label={`Remove ${task?.label} from this run`}
                      onClick={() =>
                        run({ operation: 'routine.removeExtraTask', payload: { routineId: routine.id, taskDefId: ref.taskDefId } })
                      }
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <div className="mt-sm">
          <button type="button" className="btn btn-primary" onClick={() => startRoutine(routine.id)}>
            ▶ Start
          </button>
        </div>
      </Panel>
    )
  }

  return (
    <>
      <div className="home-col">
        <Panel
          title="Backlog"
          icon="☰"
          count={partition.main.length}
          description="Everything you might do. Drag a card onto a routine, a planning session, or what's running."
          onDragOver={allowDrop}
          onDrop={handleDropOnBacklog}
        >
          <EnterForm onSubmit={addToBacklog}>
            <div className="field" onPaste={pending.onPaste}>
              <input
                type="text"
                enterKeyHint="go"
                aria-label="New backlog task"
                placeholder="What do you want to do? (or paste a link)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <MediaList items={pending.items} onRemove={pending.remove} />
              {pending.loading && <span className="field-hint">Fetching preview…</span>}
            </div>
            {(label.trim() || pending.items.length > 0) && (
              <>
                <TaskTagPicker
                  hobbies={hobbies}
                  skills={skills}
                  selectedHobbyIds={hobbyIds}
                  selectedSkillIds={skillIds}
                  kind={kind}
                  onToggleHobby={toggleHobby}
                  onToggleSkill={toggleSkill}
                  onChangeKind={setKind}
                />
                <button type="submit" className="btn btn-primary">
                  + Add to backlog
                </button>
              </>
            )}
          </EnterForm>

          {habitStrip()}
          {ongoingStrips()}
          <div className="backlog-toolbar" role="toolbar" aria-label="Backlog view">
            <button
              type="button"
              className="view-btn"
              title="Change the order"
              onClick={() => setView({ sort: NEXT_SORT[view.sort] })}
            >
              ⇅ {SORT_LABEL[view.sort]}
            </button>
            <button
              type="button"
              className="view-btn"
              title="Group by hobby or skill"
              onClick={() => setView({ group: NEXT_GROUP[view.group] })}
            >
              ⊞ {GROUP_LABEL[view.group]}
            </button>
            <button
              type="button"
              className="view-btn"
              aria-pressed={view.compact}
              title="Compact: one line per task"
              onClick={() => {
                setView({ compact: !view.compact })
                setExpandedId(null)
              }}
            >
              ≡
            </button>
          </div>
          <div className={view.compact ? 'backlog-list is-compact mt-xs' : 'stack stack-sm mt-xs'}>
            {partition.main.length === 0 && <p className="empty-hint">Nothing in the backlog yet.</p>}
            {sections.map((section) => (
              <Fragment key={section.id ?? 'untagged'}>
                {view.group !== 'none' && (
                  <div className="backlog-group">
                    <span className={section.id ? `dot ${view.group === 'hobby' ? 'dot-amber' : 'dot-violet'}` : 'dot'} />
                    {section.name}
                    <span className="panel-count">({section.tasks.length})</span>
                  </div>
                )}
                {section.tasks.map((t) => (
                  <Fragment key={t.id}>{backlogItem(t)}</Fragment>
                ))}
              </Fragment>
            ))}
          </div>
        </Panel>
      </div>

      <div className="home-col stack">
        {running.map(runningPanel)}

        <div className="col-heading">
          <span>Routines</span>
          <Link to="/routines/new" className="icon-btn" title="New routine">
            + new
          </Link>
        </div>
        {routines.length === 0 && (
          <p className="empty-hint">
            No routines yet. <Link to="/routines/new">Make one</Link> for things you do again and again.
          </p>
        )}
        <div className="bucket-grid">{routines.map(routinePanel)}</div>

        <div className="col-heading">
          <span>Planning sessions</span>
        </div>
        <div className="bucket-grid">
          {buckets.map((bucket) => {
            const orderedTaskIds = [...bucket.taskRefs].sort((a, b) => a.order - b.order).map((r) => r.taskDefId)
            const bucketTasks = orderedTaskIds
              .map((id) => taskDefById.get(id))
              .filter((t): t is TaskDef => t !== undefined)
            return (
              <Panel
                key={bucket.id}
                icon="◆"
                title={
                  <InlineEdit
                    value={bucket.name}
                    ariaLabel="Planning session name"
                    onSave={(name) => run({ operation: 'bucket.rename', payload: { id: bucket.id, name } })}
                    className="bold"
                  />
                }
                count={bucketTasks.length}
                actions={
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Delete ${bucket.name}`}
                    title="Delete planning session"
                    onClick={() => run({ operation: 'bucket.delete', payload: { id: bucket.id } })}
                  >
                    ×
                  </button>
                }
                onDragOver={allowDrop}
                onDrop={dropOn({ type: 'bucket', id: bucket.id })}
              >
                <div className="stack stack-sm drop-zone">
                  {bucketTasks.length === 0 && <p className="empty-hint">Drag tasks here.</p>}
                  {bucketTasks.map((task) => (
                    <div
                      key={task.id}
                      onDragOver={allowDrop}
                      onDrop={(e) => handleDropOnBucketTask(e, bucket, task.id)}
                    >
                      {bucketCard(task, bucket)}
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={bucketTasks.length === 0}
                      onClick={() => startBucket(bucket.id)}
                    >
                      ▶ Start session
                    </button>
                  </div>
                </div>
              </Panel>
            )
          })}

          <Panel title="New planning session" icon="+">
            <EnterForm className="row" onSubmit={createBucket}>
              <input
                type="text"
                enterKeyHint="go"
                aria-label="New planning session name"
                placeholder="e.g. Tonight's drawing"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
              />
              <button type="submit" className="btn">
                Create
              </button>
            </EnterForm>
          </Panel>
        </div>
      </div>

      {finishingTask && (
        <ConfirmDialog
          title={`Finish "${finishingTask.label}"?`}
          confirmLabel="Mark finished"
          onConfirm={() => finishTask(finishingTask)}
          onCancel={() => setFinishingTask(null)}
        >
          <p>
            It leaves the backlog and is recorded as a milestone in Progress. You can restore it from the
            Task Library if you change your mind.
          </p>
        </ConfirmDialog>
      )}
      {menu && (
        <TaskContextMenu
          anchor={menu}
          onClose={() => setMenu(null)}
          onEdit={rootTasks.some((t) => t.id === menu.taskDefId) ? (id) => setEditingTaskId(id) : undefined}
        />
      )}
    </>
  )
}
