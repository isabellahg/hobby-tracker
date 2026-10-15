import { useMemo, useState } from 'react'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { Chip } from '../../components/Chip'
import { InlineEdit } from '../../components/InlineEdit'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Panel } from '../../components/Panel'
import { sessionTitle } from '../session/sessionTitle'
import { EntryLine } from '../session/EntryLine'

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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deletingSession = deletingId ? sessions.find((s) => s.id === deletingId) : undefined

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

  const hobbyById = new Map(hobbies.map((h) => [h.id, h]))
  const skillById = new Map(skills.map((s) => [s.id, s]))
  const totalMinutes = Math.round(filtered.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) / 60)

  return (
    <div className="stack">
      <div className="page-header">
        <h2>History</h2>
        <span className="muted small">
          {filtered.length} session{filtered.length === 1 ? '' : 's'} · {totalMinutes} min
        </span>
      </div>

      <Panel title="Filters" icon="⚲">
        <div className="row wrap row-top">
          <div className="field field-narrow">
            <label htmlFor="f-start">From</label>
            <input id="f-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field field-narrow">
            <label htmlFor="f-end">To</label>
            <input id="f-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="field field-narrow">
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
          <div className="field field-narrow">
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
          <div className="field field-narrow">
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
      </Panel>

      <Panel title="Sessions" icon="≡" count={filtered.length}>
        {filtered.length === 0 && <p className="empty-hint">No sessions match these filters.</p>}
        <ul className="list-plain">
          {filtered.map((s) => {
            const completed = s.taskEntries.filter((e) => e.status === 'completed')
            const unfinished = s.taskEntries.filter((e) => e.status === 'pending')
            const isExpanded = expandedId === s.id
            const discarded = s.state === 'discarded'
            return (
              <li key={s.id} className="list-item">
                <div className="row wrap">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Hide details' : 'Show details'}
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                  <span className={discarded ? 'dot' : 'dot dot-success'} />
                  <span className="muted">{s.dateKey}</span>
                  <InlineEdit
                    value={sessionTitle(s, routines)}
                    ariaLabel="Session name"
                    onSave={(name) => run({ operation: 'session.rename', payload: { sessionId: s.id, name } })}
                    className={discarded ? 'muted' : undefined}
                  />
                  {s.hobbyIds.map((id) => (
                    <Chip key={id} tone="hobby">
                      {hobbyById.get(id)?.name ?? '?'}
                    </Chip>
                  ))}
                  {s.skillIds.map((id) => (
                    <Chip key={id} tone="skill">
                      {skillById.get(id)?.name ?? '?'}
                    </Chip>
                  ))}
                  <span className="list-row-meta">
                    {discarded
                      ? 'discarded'
                      : `${completed.length}/${s.taskEntries.length} tasks${
                          s.durationSec !== undefined ? ` · ${s.durationSec < 60 ? "<1m" : `${Math.round(s.durationSec / 60)}m`}` : ''
                        }`}
                  </span>
                </div>
                {isExpanded && (
                  <div className="list-item-details row row-top wrap gap-lg">
                    <div>
                      <div className="section-title small">Completed ({completed.length})</div>
                      <ul className="list-bullets">
                        {completed.map((e) => (
                          <li key={e.id}>
                <EntryLine entry={e} entries={s.taskEntries} />
              </li>
                        ))}
                        {completed.length === 0 && <li className="muted">None</li>}
                      </ul>
                    </div>
                    <div>
                      <div className="section-title small">Unfinished ({unfinished.length})</div>
                      <ul className="list-bullets">
                        {unfinished.map((e) => (
                          <li key={e.id}>
                <EntryLine entry={e} entries={s.taskEntries} />
              </li>
                        ))}
                        {unfinished.length === 0 && <li className="muted">None</li>}
                      </ul>
                    </div>
                    <div className="ml-auto">
                      <button type="button" className="btn btn-danger" onClick={() => setDeletingId(s.id)}>
                        Delete session
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Panel>

      {deletingSession && (
        <ConfirmDialog
          title="Delete this session?"
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            await run({ operation: 'session.delete', payload: { sessionId: deletingSession.id } })
            setDeletingId(null)
          }}
          onCancel={() => setDeletingId(null)}
        >
          <p>
            "{sessionTitle(deletingSession, routines)}" on {deletingSession.dateKey} will be removed for good. If it
            was the only session that day, the day loses its activity mark.
          </p>
        </ConfirmDialog>
      )}
    </div>
  )
}
