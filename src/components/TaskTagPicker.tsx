import type { Hobby } from '../domain/types/hobby'
import type { Skill } from '../domain/types/skill'

/**
 * Hobby and skill are picked independently — this is deliberately not a
 * cascading "pick a hobby, then its skills" control. A task can carry
 * either, both, or neither.
 */
export function TaskTagPicker({
  hobbies,
  skills,
  selectedHobbyIds,
  selectedSkillIds,
  isRecurring,
  onToggleHobby,
  onToggleSkill,
  onToggleRecurring,
}: {
  hobbies: Hobby[]
  skills: Skill[]
  selectedHobbyIds: string[]
  selectedSkillIds: string[]
  isRecurring: boolean
  onToggleHobby: (id: string) => void
  onToggleSkill: (id: string) => void
  onToggleRecurring: (value: boolean) => void
}) {
  return (
    <div className="stack">
      {hobbies.length > 0 && (
        <div className="field">
          <label>Hobby</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {hobbies.map((h) => (
              <button
                key={h.id}
                type="button"
                className="btn"
                style={{ background: selectedHobbyIds.includes(h.id) ? 'var(--accent-dim)' : undefined }}
                onClick={() => onToggleHobby(h.id)}
              >
                {h.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {skills.length > 0 && (
        <div className="field">
          <label>Skill</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {skills.map((sk) => (
              <button
                key={sk.id}
                type="button"
                className="btn"
                style={{ background: selectedSkillIds.includes(sk.id) ? 'var(--accent-dim)' : undefined }}
                onClick={() => onToggleSkill(sk.id)}
              >
                {sk.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="row" style={{ marginBottom: 0 }}>
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => onToggleRecurring(e.target.checked)}
        />
        Recurring habit (stays in the backlog after a session uses it)
      </label>
    </div>
  )
}
