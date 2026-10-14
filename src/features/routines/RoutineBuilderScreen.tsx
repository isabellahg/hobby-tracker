import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'

export function RoutineBuilderScreen() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()

  const existing = useAppStore((s) => (isNew ? undefined : s.routines.find((r) => r.id === id)))
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const allTaskDefs = useAppStore((s) => s.taskDefs)
  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((s2) => !s2.archived)
  const taskDefs = allTaskDefs.filter((t) => !t.archived)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [hobbyIds, setHobbyIds] = useState<string[]>([])
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [taskDefIds, setTaskDefIds] = useState<string[]>([])
  const [quickAddLabel, setQuickAddLabel] = useState('')

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setDescription(existing.description ?? '')
      setHobbyIds(existing.hobbyIds)
      setSkillIds(existing.skillIds)
      setTaskDefIds([...existing.taskRefs].sort((a, b) => a.order - b.order).map((r) => r.taskDefId))
    }
  }, [existing])

  const taskDefById = useMemo(() => new Map(taskDefs.map((t) => [t.id, t])), [taskDefs])
  const availableToAdd = taskDefs.filter((t) => !taskDefIds.includes(t.id))

  function toggle(list: string[], setList: (v: string[]) => void, id2: string) {
    setList(list.includes(id2) ? list.filter((x) => x !== id2) : [...list, id2])
  }

  async function quickAddTask() {
    const label = quickAddLabel.trim()
    if (!label) return
    const result = await run({ operation: 'taskDef.create', payload: { label, skillIds: [] } })
    if (result.success && result.changes[0]) {
      setTaskDefIds((ids) => [...ids, result.changes[0].id])
      setQuickAddLabel('')
    }
  }

  async function save() {
    if (!name.trim()) return
    const payload = { name: name.trim(), description: description.trim() || undefined, hobbyIds, skillIds, taskDefIds }
    const result = isNew
      ? await run({ operation: 'routine.create', payload })
      : await run({ operation: 'routine.update', payload: { id, ...payload } })
    if (result.success) navigate('/routines')
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>{isNew ? 'New routine' : `Edit "${existing?.name ?? ''}"`}</h2>
      </div>

      <div className="card stack">
        <div className="field">
          <label htmlFor="routine-name">Name</label>
          <input id="routine-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="routine-desc">Description (optional)</label>
          <textarea
            id="routine-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {hobbies.length > 0 && (
          <div className="field">
            <label>Hobbies</label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {hobbies.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className="btn"
                  style={{ background: hobbyIds.includes(h.id) ? 'var(--accent-dim)' : undefined }}
                  onClick={() => toggle(hobbyIds, setHobbyIds, h.id)}
                >
                  {h.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {skills.length > 0 && (
          <div className="field">
            <label>Skills</label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {skills.map((sk) => (
                <button
                  key={sk.id}
                  type="button"
                  className="btn"
                  style={{ background: skillIds.includes(sk.id) ? 'var(--accent-dim)' : undefined }}
                  onClick={() => toggle(skillIds, setSkillIds, sk.id)}
                >
                  {sk.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Tasks ({taskDefIds.length})</h3>
        {taskDefIds.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="stack">
            {taskDefIds.map((tid) => (
              <li key={tid} className="row" style={{ justifyContent: 'space-between' }}>
                <span>{taskDefById.get(tid)?.label ?? '(unknown task)'}</span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setTaskDefIds((ids) => ids.filter((x) => x !== tid))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {availableToAdd.length > 0 && (
          <div className="field">
            <label htmlFor="task-add">Add existing task</label>
            <select
              id="task-add"
              value=""
              onChange={(e) => {
                if (e.target.value) setTaskDefIds((ids) => [...ids, e.target.value])
              }}
            >
              <option value="" disabled>
                Choose a task…
              </option>
              {availableToAdd.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="row">
          <input
            type="text"
            placeholder="Quick-add a new task"
            value={quickAddLabel}
            onChange={(e) => setQuickAddLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && quickAddTask()}
          />
          <button type="button" className="btn" onClick={quickAddTask}>
            Add
          </button>
        </div>
      </div>

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={save}>
          Save routine
        </button>
        <button type="button" className="btn" onClick={() => navigate('/routines')}>
          Cancel
        </button>
      </div>
    </div>
  )
}
