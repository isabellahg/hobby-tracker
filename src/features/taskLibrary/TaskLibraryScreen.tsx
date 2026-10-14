import { useState } from 'react'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { EmptyState } from '../../components/EmptyState'
import { Chip } from '../../components/Chip'
import { TaskTagPicker } from '../../components/TaskTagPicker'

export function TaskLibraryScreen() {
  const allTaskDefs = useAppStore((s) => s.taskDefs)
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const taskDefs = allTaskDefs.filter((t) => !t.archived)
  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((sk) => !sk.archived)

  const [label, setLabel] = useState('')
  const [selectedHobbyIds, setSelectedHobbyIds] = useState<string[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [isRecurring, setIsRecurring] = useState(false)

  function toggleHobby(id: string) {
    setSelectedHobbyIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }
  function toggleSkill(id: string) {
    setSelectedSkillIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  async function createTask() {
    if (!label.trim()) return
    await run({
      operation: 'taskDef.create',
      payload: {
        label: label.trim(),
        hobbyIds: selectedHobbyIds,
        skillIds: selectedSkillIds,
        isRecurring,
      },
    })
    setLabel('')
    setSelectedHobbyIds([])
    setSelectedSkillIds([])
    setIsRecurring(false)
  }

  async function archiveTask(id: string) {
    await run({ operation: 'taskDef.archive', payload: { id, archived: true } })
  }

  const hobbyById = new Map(hobbies.map((h) => [h.id, h]))
  const skillById = new Map(skills.map((s) => [s.id, s]))

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Task Library</h2>
      </div>
      <p className="muted">
        Your backlog. Build tasks here, inline while creating a routine, or from the quick-add on Home —
        they all land in the same place.
      </p>

      <div className="card stack">
        <div className="field">
          <label htmlFor="task-label">New task</label>
          <input
            id="task-label"
            type="text"
            placeholder="e.g. Collect references"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTask()}
          />
        </div>
        <TaskTagPicker
          hobbies={hobbies}
          skills={skills}
          selectedHobbyIds={selectedHobbyIds}
          selectedSkillIds={selectedSkillIds}
          isRecurring={isRecurring}
          onToggleHobby={toggleHobby}
          onToggleSkill={toggleSkill}
          onToggleRecurring={setIsRecurring}
        />
        <div>
          <button type="button" className="btn btn-primary" onClick={createTask}>
            Add task
          </button>
        </div>
      </div>

      {taskDefs.length === 0 && <EmptyState>No tasks yet.</EmptyState>}

      <div className="stack">
        {taskDefs.map((task) => (
          <div key={task.id} className="card row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{task.label}</strong>
              {task.isRecurring && <span className="chip" style={{ marginLeft: 8 }}>recurring</span>}
              <div className="row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                {task.hobbyIds.map((id) => (
                  <Chip key={id}>{hobbyById.get(id)?.name ?? '?'}</Chip>
                ))}
                {task.skillIds.map((id) => (
                  <Chip key={id}>{skillById.get(id)?.name ?? '?'}</Chip>
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-danger" onClick={() => archiveTask(task.id)}>
              Archive
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
