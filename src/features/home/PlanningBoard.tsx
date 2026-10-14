import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { TaskTagPicker } from '../../components/TaskTagPicker'
import { EmptyState } from '../../components/EmptyState'
import { Chip } from '../../components/Chip'
import type { PlanBucket } from '../../domain/types/planBucket'

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

export function PlanningBoard() {
  const navigate = useNavigate()
  const allTaskDefs = useAppStore((s) => s.taskDefs)
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const buckets = useAppStore((s) => s.planBuckets)

  const taskDefs = allTaskDefs.filter((t) => !t.archived)
  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((sk) => !sk.archived)
  const taskDefById = new Map(taskDefs.map((t) => [t.id, t]))
  const hobbyById = new Map(hobbies.map((h) => [h.id, h]))
  const skillById = new Map(skills.map((s) => [s.id, s]))

  const [label, setLabel] = useState('')
  const [hobbyIds, setHobbyIds] = useState<string[]>([])
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [isRecurring, setIsRecurring] = useState(false)
  const [newBucketName, setNewBucketName] = useState('')

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
      payload: { label: label.trim(), hobbyIds, skillIds, isRecurring },
    })
    setLabel('')
    setHobbyIds([])
    setSkillIds([])
    setIsRecurring(false)
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

  function taskCard(taskId: string, sourceBucketId: string | null) {
    const task = taskDefById.get(taskId)
    if (!task) return null
    return (
      <div
        key={taskId}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ taskDefId: taskId, sourceBucketId }))
          e.dataTransfer.effectAllowed = 'move'
        }}
        className="card"
        style={{ padding: '0.5rem 0.75rem', cursor: 'grab' }}
      >
        <div>{task.label}</div>
        <div className="row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
          {task.isRecurring && <Chip>recurring</Chip>}
          {task.hobbyIds.map((id) => (
            <Chip key={id}>{hobbyById.get(id)?.name ?? '?'}</Chip>
          ))}
          {task.skillIds.map((id) => (
            <Chip key={id}>{skillById.get(id)?.name ?? '?'}</Chip>
          ))}
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
            isRecurring={isRecurring}
            onToggleHobby={toggleHobby}
            onToggleSkill={toggleSkill}
            onToggleRecurring={setIsRecurring}
          />
          <div>
            <button type="button" className="btn btn-primary" onClick={addToBacklog}>
              Add to backlog
            </button>
          </div>

          <div className="stack" style={{ marginTop: '0.5rem' }}>
            {taskDefs.length === 0 && <EmptyState>Nothing in the backlog yet.</EmptyState>}
            {taskDefs.map((t) => taskCard(t.id, null))}
          </div>
        </div>

        <div className="stack">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {buckets.map((bucket) => {
              const orderedTaskIds = [...bucket.taskRefs].sort((a, b) => a.order - b.order).map((r) => r.taskDefId)
              return (
                <div
                  key={bucket.id}
                  className="card stack"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnBucket(e, bucket)}
                  style={{ alignSelf: 'start' }}
                >
                  <input
                    type="text"
                    defaultValue={bucket.name}
                    onBlur={(e) => {
                      const name = e.target.value.trim()
                      if (name && name !== bucket.name) {
                        run({ operation: 'bucket.rename', payload: { id: bucket.id, name } })
                      }
                    }}
                    style={{ fontWeight: 600, border: 'none', background: 'transparent', padding: 0 }}
                  />
                  <div className="stack" style={{ minHeight: 40 }}>
                    {orderedTaskIds.length === 0 && (
                      <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                        Drag tasks here.
                      </p>
                    )}
                    {orderedTaskIds.map((taskId) => (
                      <div
                        key={taskId}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropOnBucketTask(e, bucket, taskId)}
                      >
                        {taskCard(taskId, bucket.id)}
                      </div>
                    ))}
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={orderedTaskIds.length === 0}
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
    </div>
  )
}
