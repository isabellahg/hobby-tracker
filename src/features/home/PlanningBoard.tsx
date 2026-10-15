import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { countSessionsForTask } from '../../domain/logic/taskProgress'
import { TaskTagPicker } from '../../components/TaskTagPicker'
import { kindLabel as kindName } from '../../components/taskKinds'
import { TaskEditor } from '../../components/TaskEditor'
import { InlineEdit } from '../../components/InlineEdit'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Chip } from '../../components/Chip'
import type { PlanBucket } from '../../domain/types/planBucket'
import type { TaskDef, TaskKind } from '../../domain/types/taskDef'

interface DragPayload {
  taskDefId: string
  /** null when dragged straight from the backlog, not out of another bucket. */
  sourceBucketId: string | null
}

const DRAG_MIME = 'application/x-plan-task'

function readDragPayload(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DRAG_MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

function kindLabel(kind: TaskKind): string {
  return kindName(kind).toLowerCase()
}

function startDrag(e: React.DragEvent, payload: DragPayload) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'move'
}

export function PlanningBoard() {
  const navigate = useNavigate()
  const allTaskDefs = useAppStore((s) => s.taskDefs)
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const buckets = useAppStore((s) => s.planBuckets)
  const sessions = useAppStore((s) => s.sessions)

  const taskDefs = allTaskDefs.filter((t) => !t.archived)
  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((sk) => !sk.archived)
  const taskDefById = new Map(taskDefs.map((t) => [t.id, t]))
  const hobbyById = new Map(allHobbies.map((h) => [h.id, h]))
  const skillById = new Map(allSkills.map((s) => [s.id, s]))

  const [label, setLabel] = useState('')
  const [hobbyIds, setHobbyIds] = useState<string[]>([])
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [kind, setKind] = useState<TaskKind>('once')
  const [newBucketName, setNewBucketName] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [finishingTask, setFinishingTask] = useState<TaskDef | null>(null)

  function toggleHobby(id: string) {
    setHobbyIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }
  function toggleSkill(id: string) {
    setSkillIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  async function addToBacklog() {
    if (!label.trim()) return
    await run({
      operation: 'taskDef.create',
      payload: { label: label.trim(), hobbyIds, skillIds, kind },
    })
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

  async function finishTask(task: TaskDef) {
    await run({ operation: 'taskDef.finish', payload: { id: task.id } })
    setFinishingTask(null)
  }

  function moveTask(payload: DragPayload, targetBucketId: string) {
    if (payload.sourceBucketId === targetBucketId) return
    if (payload.sourceBucketId) {
      run({
        operation: 'bucket.removeTask',
        payload: { bucketId: payload.sourceBucketId, taskDefId: payload.taskDefId },
      })
    }
    run({ operation: 'bucket.addTask', payload: { bucketId: targetBucketId, taskDefId: payload.taskDefId } })
  }

  function reorderWithinBucket(bucket: PlanBucket, draggedTaskDefId: string, beforeTaskDefId: string) {
    const currentIds = [...bucket.taskRefs].sort((a, b) => a.order - b.order).map((r) => r.taskDefId)
    const withoutDragged = currentIds.filter((id) => id !== draggedTaskDefId)
    const insertAt = withoutDragged.indexOf(beforeTaskDefId)
    withoutDragged.splice(insertAt, 0, draggedTaskDefId)
    run({ operation: 'bucket.reorderTasks', payload: { bucketId: bucket.id, orderedTaskDefIds: withoutDragged } })
  }

  function handleDropOnBucket(e: React.DragEvent, bucket: PlanBucket) {
    e.preventDefault()
    const payload = readDragPayload(e)
    if (!payload) return
    moveTask(payload, bucket.id)
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
    moveTask(payload, bucket.id)
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
          <Chip key={id}>{hobbyById.get(id)?.name ?? '?'}</Chip>
        ))}
        {task.skillIds.map((id) => (
          <Chip key={id}>{skillById.get(id)?.name ?? '?'}</Chip>
        ))}
      </>
    )
  }

  function backlogCard(task: TaskDef) {
    if (editingTaskId === task.id) {
      return (
        <div key={task.id} className="card" style={{ padding: '0.75rem' }}>
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
        className="card stack"
        style={{ padding: '0.5rem 0.75rem', cursor: 'grab', gap: '0.35rem' }}
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>{task.label}</span>
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
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {tagChips(task)}
          {task.kind === 'ongoing' && (
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              {sessionCount} session{sessionCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {task.kind === 'ongoing' && (
          <>
            <div className="row" style={{ fontSize: '0.85rem' }}>
              <span className="muted">Next:</span>
              <InlineEdit
                value={task.nextAction ?? ''}
                placeholder="set a next action"
                ariaLabel={`Next action for ${task.label}`}
                onSave={(nextAction) => run({ operation: 'taskDef.update', payload: { id: task.id, nextAction } })}
              />
            </div>
            <div>
              <button type="button" className="btn" onClick={() => setFinishingTask(task)}>
                ✓ Mark finished
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  function bucketCard(task: TaskDef, bucket: PlanBucket) {
    return (
      <div
        draggable
        onDragStart={(e) => startDrag(e, { taskDefId: task.id, sourceBucketId: bucket.id })}
        className="card"
        style={{ padding: '0.5rem 0.75rem', cursor: 'grab' }}
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
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
        <div className="row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
          {tagChips(task)}
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <h2>Plan your next session</h2>
      <p className="muted" style={{ marginTop: '-0.5rem' }}>
        Dump anything you want to do into the backlog, drag it into a planning session, then start it
        whenever you're ready.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 2fr', gap: '1rem' }}>
        <div
          className="card stack"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnBacklog}
          style={{ alignSelf: 'start' }}
        >
          <h3 style={{ margin: 0 }}>Backlog</h3>
          <div className="field">
            <input
              type="text"
              aria-label="New backlog task"
              placeholder="What do you want to do?"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addToBacklog()}
            />
          </div>
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
          <div>
            <button type="button" className="btn btn-primary" onClick={addToBacklog}>
              Add to backlog
            </button>
          </div>

          <div className="stack" style={{ marginTop: '0.5rem' }}>
            {taskDefs.length === 0 && <EmptyState>Nothing in the backlog yet.</EmptyState>}
            {taskDefs.map((t) => backlogCard(t))}
          </div>
        </div>

        <div className="stack">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {buckets.map((bucket) => {
              const orderedTaskIds = [...bucket.taskRefs].sort((a, b) => a.order - b.order).map((r) => r.taskDefId)
              const bucketTasks = orderedTaskIds
                .map((id) => taskDefById.get(id))
                .filter((t): t is TaskDef => t !== undefined)
              return (
                <div
                  key={bucket.id}
                  className="card stack"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnBucket(e, bucket)}
                  style={{ alignSelf: 'start' }}
                >
                  <InlineEdit
                    value={bucket.name}
                    ariaLabel="Planning session name"
                    onSave={(name) => run({ operation: 'bucket.rename', payload: { id: bucket.id, name } })}
                    style={{ fontWeight: 600 }}
                  />
                  <div className="stack" style={{ minHeight: 40 }}>
                    {bucketTasks.length === 0 && (
                      <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                        Drag tasks here.
                      </p>
                    )}
                    {bucketTasks.map((task) => (
                      <div
                        key={task.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropOnBucketTask(e, bucket, task.id)}
                      >
                        {bucketCard(task, bucket)}
                      </div>
                    ))}
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={bucketTasks.length === 0}
                      onClick={() => startBucket(bucket.id)}
                    >
                      Start session
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => run({ operation: 'bucket.delete', payload: { id: bucket.id } })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}

            <div className="card stack" style={{ alignSelf: 'start' }}>
              <h3 style={{ margin: 0 }}>+ New planning session</h3>
              <div className="row">
                <input
                  type="text"
                  aria-label="New planning session name"
                  placeholder="e.g. Tonight's drawing"
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createBucket()}
                />
                <button type="button" className="btn" onClick={createBucket}>
                  Create
                </button>
              </div>
            </div>
          </div>
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
    </div>
  )
}
