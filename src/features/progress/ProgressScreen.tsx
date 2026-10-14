import { useMemo, useState } from 'react'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { isQualifyingSession } from '../../domain/logic/qualifyingSession'
import { EmptyState } from '../../components/EmptyState'

type Tab = 'volume' | 'tasks' | 'records'

export function ProgressScreen() {
  const sessions = useAppStore((s) => s.sessions)
  const skills = useAppStore((s) => s.skills)
  const hobbies = useAppStore((s) => s.hobbies)
  const records = useAppStore((s) => s.personalRecords)
  const [tab, setTab] = useState<Tab>('volume')

  const qualifying = useMemo(() => sessions.filter(isQualifyingSession), [sessions])

  const sessionCountBySkill = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of qualifying) {
      for (const id of s.skillIds) counts[id] = (counts[id] ?? 0) + 1
    }
    return counts
  }, [qualifying])

  const maxCount = Math.max(1, ...Object.values(sessionCountBySkill))

  const [recHobbyId, setRecHobbyId] = useState('')
  const [recSkillId, setRecSkillId] = useState('')
  const [recDescription, setRecDescription] = useState('')

  async function addRecord() {
    if (!recHobbyId || !recDescription.trim()) return
    await run({
      operation: 'record.create',
      payload: {
        hobbyId: recHobbyId,
        skillId: recSkillId || undefined,
        date: new Date().toISOString().slice(0, 10),
        description: recDescription.trim(),
      },
    })
    setRecDescription('')
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Progress</h2>
      </div>

      <div className="row">
        <button type="button" className="btn" style={{ background: tab === 'volume' ? 'var(--accent-dim)' : undefined }} onClick={() => setTab('volume')}>
          Activity by skill
        </button>
        <button type="button" className="btn" style={{ background: tab === 'tasks' ? 'var(--accent-dim)' : undefined }} onClick={() => setTab('tasks')}>
          Task completion
        </button>
        <button type="button" className="btn" style={{ background: tab === 'records' ? 'var(--accent-dim)' : undefined }} onClick={() => setTab('records')}>
          Milestones
        </button>
      </div>

      {tab === 'volume' && (
        <div className="card stack">
          <p className="muted">
            Session frequency per skill — this measures how often you practiced, not how skilled you've
            become. More sessions is not the same as more proficiency.
          </p>
          {skills.length === 0 && <EmptyState>No skills yet.</EmptyState>}
          {skills.map((skill) => {
            const count = sessionCountBySkill[skill.id] ?? 0
            return (
              <div key={skill.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{skill.name}</span>
                  <span className="muted">{count} session(s)</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-elevated-2)', borderRadius: 999 }}>
                  <div
                    style={{
                      width: `${(count / maxCount) * 100}%`,
                      height: '100%',
                      background: 'var(--accent)',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="card stack">
          {qualifying.length === 0 && <EmptyState>No finished sessions yet.</EmptyState>}
          {qualifying
            .slice()
            .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
            .map((s) => {
              const completed = s.taskEntries.filter((e) => e.status === 'completed').length
              return (
                <div key={s.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{s.dateKey}</span>
                  <span className="muted">
                    {completed}/{s.taskEntries.length} tasks
                  </span>
                </div>
              )
            })}
        </div>
      )}

      {tab === 'records' && (
        <div className="stack">
          <div className="card stack">
            <h3 style={{ margin: 0 }}>Record a milestone</h3>
            <div className="row">
              <select value={recHobbyId} onChange={(e) => setRecHobbyId(e.target.value)}>
                <option value="">Hobby…</option>
                {hobbies.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <select value={recSkillId} onChange={(e) => setRecSkillId(e.target.value)}>
                <option value="">Skill (optional)…</option>
                {skills.filter((sk) => sk.hobbyId === recHobbyId).map((sk) => (
                  <option key={sk.id} value={sk.id}>
                    {sk.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              placeholder="e.g. Implemented a working boss attack"
              value={recDescription}
              onChange={(e) => setRecDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRecord()}
            />
            <div>
              <button type="button" className="btn btn-primary" onClick={addRecord}>
                Save milestone
              </button>
            </div>
          </div>

          {records.length === 0 && <EmptyState>No milestones recorded yet.</EmptyState>}
          <div className="stack">
            {records
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((r) => (
                <div key={r.id} className="card">
                  <div className="muted">{r.date}</div>
                  <div>{r.description}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
