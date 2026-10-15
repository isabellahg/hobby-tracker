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
    <div>
      <div className="field">
        <label>Type</label>
        <div className="row wrap" role="radiogroup" aria-label="Task type">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              role="radio"
              aria-checked={kind === opt.kind}
              className="pill"
              title={opt.hint}
              onClick={() => onChangeKind(opt.kind)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="field-hint">{KIND_OPTIONS.find((o) => o.kind === kind)?.hint}</span>
      </div>
      {hobbies.length > 0 && (
        <div className="field">
          <label>Hobby</label>
          <div className="row wrap">
            {hobbies.map((h) => (
              <button
                key={h.id}
                type="button"
                className="pill pill-hobby"
                aria-pressed={selectedHobbyIds.includes(h.id)}
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
          <div className="row wrap">
            {skills.map((sk) => (
              <button
                key={sk.id}
                type="button"
                className="pill"
                aria-pressed={selectedSkillIds.includes(sk.id)}
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
