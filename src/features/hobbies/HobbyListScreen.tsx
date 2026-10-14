import { useState } from 'react'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { EmptyState } from '../../components/EmptyState'
import { Chip } from '../../components/Chip'

export function HobbyListScreen() {
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((sk) => !sk.archived)
  const [newHobbyName, setNewHobbyName] = useState('')
  const [skillDrafts, setSkillDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  async function createHobby() {
    if (!newHobbyName.trim()) return
    const result = await run({ operation: 'hobby.create', payload: { name: newHobbyName.trim() } })
    if (!result.success) {
      setError(result.errors?.[0]?.message ?? 'Failed to create hobby')
      return
    }
    setNewHobbyName('')
    setError(null)
  }

  async function createSkill(hobbyId: string) {
    const name = (skillDrafts[hobbyId] ?? '').trim()
    if (!name) return
    const result = await run({ operation: 'skill.create', payload: { hobbyId, name } })
    if (!result.success) {
      setError(result.errors?.[0]?.message ?? 'Failed to create skill')
      return
    }
    setSkillDrafts((d) => ({ ...d, [hobbyId]: '' }))
    setError(null)
  }

  async function archiveHobby(id: string) {
    await run({ operation: 'hobby.archive', payload: { id, archived: true } })
  }

  async function archiveSkill(id: string) {
    await run({ operation: 'skill.archive', payload: { id, archived: true } })
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Hobbies & Skills</h2>
      </div>

      <div className="card row">
        <input
          type="text"
          placeholder="New hobby name (e.g. Game development)"
          value={newHobbyName}
          onChange={(e) => setNewHobbyName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createHobby()}
        />
        <button type="button" className="btn btn-primary" onClick={createHobby}>
          Add hobby
        </button>
      </div>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {hobbies.length === 0 && <EmptyState>No hobbies yet. Add your first one above.</EmptyState>}

      <div className="stack">
        {hobbies.map((hobby) => {
          const hobbySkills = skills.filter((sk) => sk.hobbyId === hobby.id)
          return (
            <div key={hobby.id} className="card stack">
              <div className="page-header" style={{ marginBottom: 0 }}>
                <h3 style={{ margin: 0 }}>{hobby.name}</h3>
                <button type="button" className="btn btn-danger" onClick={() => archiveHobby(hobby.id)}>
                  Archive
                </button>
              </div>
              {hobby.description && <p className="muted">{hobby.description}</p>}

              <div className="row" style={{ flexWrap: 'wrap' }}>
                {hobbySkills.map((skill) => (
                  <Chip key={skill.id}>
                    {skill.name}
                    <button
                      type="button"
                      onClick={() => archiveSkill(skill.id)}
                      aria-label={`Archive ${skill.name}`}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </Chip>
                ))}
                {hobbySkills.length === 0 && <span className="muted">No skills yet.</span>}
              </div>

              <div className="row">
                <input
                  type="text"
                  placeholder="New skill (e.g. Anatomy)"
                  value={skillDrafts[hobby.id] ?? ''}
                  onChange={(e) => setSkillDrafts((d) => ({ ...d, [hobby.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && createSkill(hobby.id)}
                />
                <button type="button" className="btn" onClick={() => createSkill(hobby.id)}>
                  Add skill
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
