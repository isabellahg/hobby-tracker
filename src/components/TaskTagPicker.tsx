import type { Hobby } from '../domain/types/hobby'
import type { Skill } from '../domain/types/skill'
import type { TaskKind } from '../domain/types/taskDef'
import { KIND_OPTIONS } from './taskKinds'

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
  kind,
  onToggleHobby,
  onToggleSkill,
  onChangeKind,
}: {
  hobbies: Hobby[]
  skills: Skill[]
  selectedHobbyIds: string[]
  selectedSkillIds: string[]
  kind: TaskKind
  onToggleHobby: (id: string) => void
  onToggleSkill: (id: string) => void
  onChangeKind: (kind: TaskKind) => void
}) {
  return (
    <div className="stack">
      <div className="field">
        <label>Type</label>
        <div className="row" style={{ flexWrap: 'wrap' }} role="radiogroup" aria-label="Task type">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              role="radio"
              aria-checked={kind === opt.kind}
              className="btn"
              title={opt.hint}
              style={{ background: kind === opt.kind ? 'var(--accent-dim)' : undefined }}
              onClick={() => onChangeKind(opt.kind)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          {KIND_OPTIONS.find((o) => o.kind === kind)?.hint}
        </span>
      </div>
      {hobbies.length > 0 && (
        <div className="field">
          <label>Hobby</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {hobbies.map((h) => (
              <button
                key={h.id}
                type="button"
                className="btn"
                aria-pressed={selectedHobbyIds.includes(h.id)}
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
                aria-pressed={selectedSkillIds.includes(sk.id)}
                style={{ background: selectedSkillIds.includes(sk.id) ? 'var(--accent-dim)' : undefined }}
                onClick={() => onToggleSkill(sk.id)}
              >
                {sk.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
