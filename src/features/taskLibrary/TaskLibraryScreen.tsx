import { useState } from 'react'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { EmptyState } from '../../components/EmptyState'
import { Chip } from '../../components/Chip'
import { TaskTagPicker } from '../../components/TaskTagPicker'
import { kindLabel } from '../../components/taskKinds'
import { TaskEditor } from '../../components/TaskEditor'
import { EnterForm } from '../../components/EnterForm'
import { MediaList } from '../../components/MediaStrip'
import { usePendingAttachments } from '../../components/usePendingAttachments'
import { MediaStrip } from '../../components/MediaStrip'
import { ArchivedSection } from '../../components/ArchivedSection'
import { Subtasks } from '../../components/Subtasks'
import { MoveToSelect } from '../../components/ListBits'
import { isTreeRoot } from '../../domain/logic/taskTree'
import type { TaskKind } from '../../domain/types/taskDef'

export function TaskLibraryScreen() {
  const allTaskDefs = useAppStore((s) => s.taskDefs)
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const taskDefs = allTaskDefs.filter((t) => !t.archived)
  const archivedTaskDefs = allTaskDefs.filter((t) => t.archived)
  const openIds = new Set(taskDefs.map((t) => t.id))
  const rootTasks = taskDefs.filter((t) => isTreeRoot(t, openIds))
  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((sk) => !sk.archived)

  const [label, setLabel] = useState('')
  const [selectedHobbyIds, setSelectedHobbyIds] = useState<string[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [kind, setKind] = useState<TaskKind>('once')
  const pending = usePendingAttachments((title) => setLabel((l) => (l.trim() ? l : title)))
  const [editingId, setEditingId] = useState<string | null>(null)

  function toggleHobby(id: string) {
    setSelectedHobbyIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }
  function toggleSkill(id: string) {
    setSelectedSkillIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  async function createTask() {
    const name = label.trim() || pending.fallbackLabel()
    if (!name) return
    const result = await run({
      operation: 'taskDef.create',
      payload: { label: name, hobbyIds: selectedHobbyIds, skillIds: selectedSkillIds, kind },
    })
    if (result.success) pending.saveTo(result.changes[0].id)
    setLabel('')
    setSelectedHobbyIds([])
    setSelectedSkillIds([])
    setKind('once')
  }

  function setArchived(id: string, archived: boolean) {
    run({ operation: 'taskDef.archive', payload: { id, archived } })
  }

  const hobbyById = new Map(allHobbies.map((h) => [h.id, h]))
  const skillById = new Map(allSkills.map((s) => [s.id, s]))

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Task Library</h2>
        <span className="muted small">
          {taskDefs.length} open · {archivedTaskDefs.length} archived
        </span>
      </div>
      <p className="desc m0">
        Every task, wherever it lives. Use the picker on a task to move it to the backlog, Habits, or one of
        your lists.
      </p>

      <EnterForm className="card stack" onSubmit={createTask}>
        <div className="field" onPaste={pending.onPaste}>
          <label htmlFor="task-label">New task</label>
          <input
            id="task-label"
            type="text"
            enterKeyHint="go"
            placeholder="e.g. Collect references — or paste a link"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <MediaList items={pending.items} onRemove={pending.remove} />
          {pending.loading && <span className="field-hint">Fetching preview…</span>}
        </div>
        <TaskTagPicker
          hobbies={hobbies}
          skills={skills}
          selectedHobbyIds={selectedHobbyIds}
          selectedSkillIds={selectedSkillIds}
          kind={kind}
          onToggleHobby={toggleHobby}
          onToggleSkill={toggleSkill}
          onChangeKind={setKind}
        />
        <div>
          <button type="submit" className="btn btn-primary">
            Add task
          </button>
        </div>
      </EnterForm>

      {taskDefs.length === 0 && <EmptyState>No tasks yet.</EmptyState>}

      <div className="stack stack-sm">
        {rootTasks.map((task) =>
          editingId === task.id ? (
            <div key={task.id} className="card">
              <TaskEditor task={task} onDone={() => setEditingId(null)} />
            </div>
          ) : (
            <div key={task.id} className="card card-tight row row-between row-top">
              <div className="grow">
                <span className="strong">{task.label}</span>
                <div className="row wrap">
                  <Chip>{kindLabel(task.kind)}</Chip>
                  {task.hobbyIds.map((id) => (
                    <Chip key={id} tone="hobby">{hobbyById.get(id)?.name ?? '?'}</Chip>
                  ))}
                  {task.skillIds.map((id) => (
                    <Chip key={id} tone="skill">{skillById.get(id)?.name ?? '?'}</Chip>
                  ))}
                </div>
                {task.kind === 'ongoing' && task.nextAction && (
                  <div className="muted small">
                    Next: {task.nextAction}
                  </div>
                )}
                <MediaStrip taskDefId={task.id} />
                <Subtasks task={task} allTasks={allTaskDefs} />
              </div>
              <div className="row">
                <MoveToSelect task={task} />
                <button type="button" className="btn" onClick={() => setEditingId(task.id)}>
                  Edit
                </button>
                <button type="button" className="btn btn-danger" onClick={() => setArchived(task.id, true)}>
                  Archive
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      <ArchivedSection
        title="Archived & finished tasks"
        items={archivedTaskDefs.map((t) => ({ id: t.id, label: t.label }))}
        onRestore={(id) => setArchived(id, false)}
      />
    </div>
  )
}
