import { useState } from 'react'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { EmptyState } from '../../components/EmptyState'
import { Chip } from '../../components/Chip'
import { InlineEdit } from '../../components/InlineEdit'
import { ArchivedSection } from '../../components/ArchivedSection'

export function HobbyListScreen() {
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((sk) => !sk.archived)
  const hobbyById = new Map(allHobbies.map((h) => [h.id, h]))
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

  function setHobbyArchived(id: string, archived: boolean) {
    run({ operation: 'hobby.archive', payload: { id, archived } })
  }

  function setSkillArchived(id: string, archived: boolean) {
    run({ operation: 'skill.archive', payload: { id, archived } })
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Hobbies & Skills</h2>
        <span className="muted small">
          {hobbies.length} hobbies · {skills.length} skills
        </span>
      </div>

      <div className="card row">
        <input
          type="text"
          aria-label="New hobby name"
          placeholder="New hobby name (e.g. Game development)"
          value={newHobbyName}
          onChange={(e) => setNewHobbyName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createHobby()}
        />
        <button type="button" className="btn btn-primary" onClick={createHobby}>
          Add hobby
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {hobbies.length === 0 && <EmptyState>No hobbies yet. Add your first one above.</EmptyState>}

      <div className="stack stack-sm">
        {hobbies.map((hobby) => {
          const hobbySkills = skills.filter((sk) => sk.hobbyId === hobby.id)
          return (
            <div key={hobby.id} className="card stack">
              <div className="page-header">
                <h3>
                  <InlineEdit
                    value={hobby.name}
                    ariaLabel="Hobby name"
                    onSave={(name) => run({ operation: 'hobby.update', payload: { id: hobby.id, name } })}
                  />
                </h3>
                <button type="button" className="btn btn-danger" onClick={() => setHobbyArchived(hobby.id, true)}>
                  Archive
                </button>
              </div>
              <div className="desc m0">
                <InlineEdit
                  value={hobby.description ?? ''}
                  placeholder="Add a description"
                  ariaLabel={`Description of ${hobby.name}`}
                  onSave={(description) =>
                    run({ operation: 'hobby.update', payload: { id: hobby.id, description } })
                  }
                />
              </div>

              <div className="row wrap">
                {hobbySkills.map((skill) => (
                  <Chip key={skill.id} tone="skill">
                    <InlineEdit
                      value={skill.name}
                      ariaLabel="Skill name"
                      onSave={(name) => run({ operation: 'skill.update', payload: { id: skill.id, name } })}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setSkillArchived(skill.id, true)}
                      aria-label={`Archive ${skill.name}`}
                      title="Archive skill"
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
                  aria-label={`New skill for ${hobby.name}`}
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

      <ArchivedSection
        title="Archived hobbies"
        items={allHobbies.filter((h) => h.archived).map((h) => ({ id: h.id, label: h.name }))}
        onRestore={(id) => setHobbyArchived(id, false)}
      />
      <ArchivedSection
        title="Archived skills"
        items={allSkills
          .filter((s) => s.archived)
          .map((s) => ({ id: s.id, label: `${s.name} (${hobbyById.get(s.hobbyId)?.name ?? 'unknown hobby'})` }))}
        onRestore={(id) => setSkillArchived(id, false)}
      />
    </div>
  )
}
