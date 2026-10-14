import { useMemo, useState } from 'react'
import { useAppStore } from '../../state/store'
import { EmptyState } from '../../components/EmptyState'
import { Chip } from '../../components/Chip'

export function HistoryScreen() {
  const sessions = useAppStore((s) => s.sessions)
  const routines = useAppStore((s) => s.routines)
  const hobbies = useAppStore((s) => s.hobbies)
  const skills = useAppStore((s) => s.skills)

  const [routineId, setRoutineId] = useState('')
  const [hobbyId, setHobbyId] = useState('')
  const [skillId, setSkillId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return sessions
      .filter((s) => s.state !== 'in_progress')
      .filter((s) => !routineId || s.routineId === routineId)
      .filter((s) => !hobbyId || s.hobbyIds.includes(hobbyId))
      .filter((s) => !skillId || s.skillIds.includes(skillId))
      .filter((s) => !start || s.dateKey >= start)
      .filter((s) => !end || s.dateKey <= end)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
  }, [sessions, routineId, hobbyId, skillId, start, end])

  const routineById = new Map(routines.map((r) => [r.id, r]))
  const hobbyById = new Map(hobbies.map((h) => [h.id, h]))
  const skillById = new Map(skills.map((s) => [s.id, s]))

  return (
    <div className="stack">
      <div className="page-header">
        <h2>History</h2>
      </div>

      <div className="card row" style={{ flexWrap: 'wrap' }}>
        <div className="field" style={{ minWidth: 140 }}>
          <label htmlFor="f-start">From</label>
          <input id="f-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label htmlFor="f-end">To</label>
          <input id="f-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <label htmlFor="f-routine">Routine</label>
          <select id="f-routine" value={routineId} onChange={(e) => setRoutineId(e.target.value)}>
            <option value="">Any</option>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <label htmlFor="f-hobby">Hobby</label>
          <select id="f-hobby" value={hobbyId} onChange={(e) => setHobbyId(e.target.value)}>
            <option value="">Any</option>
            {hobbies.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <label htmlFor="f-skill">Skill</label>
          <select id="f-skill" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
            <option value="">Any</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 && <EmptyState>No sessions match these filters.</EmptyState>}

      <div className="stack">
        {filtered.map((s) => {
          const completed = s.taskEntries.filter((e) => e.status === 'completed')
          const unfinished = s.taskEntries.filter((e) => e.status === 'pending')
          const isExpanded = expandedId === s.id
          return (
            <div key={s.id} className="card stack">
              <div
                className="row"
                style={{ justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
              >
                <div>
                  <strong>{s.dateKey}</strong>{' '}
                  {s.state === 'discarded' ? (
                    <span className="muted">(discarded)</span>
                  ) : (
                    <span className="muted">
                      {s.routineId ? routineById.get(s.routineId)?.name ?? 'Routine' : 'Flexible session'} ·{' '}
                      {completed.length}/{s.taskEntries.length} tasks
                    </span>
                  )}
                </div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {s.hobbyIds.map((id) => (
                    <Chip key={id}>{hobbyById.get(id)?.name ?? '?'}</Chip>
                  ))}
                  {s.skillIds.map((id) => (
                    <Chip key={id}>{skillById.get(id)?.name ?? '?'}</Chip>
                  ))}
                </div>
              </div>
              {isExpanded && s.state === 'finished' && (
                <div className="row" style={{ alignItems: 'flex-start', gap: '2rem' }}>
                  <div>
                    <div className="muted">Completed</div>
                    <ul style={{ margin: 0 }}>
                      {completed.map((e) => (
                        <li key={e.id}>{e.label}</li>
                      ))}
                      {completed.length === 0 && <li className="muted">None</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="muted">Unfinished</div>
                    <ul style={{ margin: 0 }}>
                      {unfinished.map((e) => (
                        <li key={e.id}>{e.label}</li>
                      ))}
                      {unfinished.length === 0 && <li className="muted">None</li>}
                    </ul>
                  </div>
                  {s.durationSec !== undefined && (
                    <div>
                      <div className="muted">Duration</div>
                      {Math.round(s.durationSec / 60)} min
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
