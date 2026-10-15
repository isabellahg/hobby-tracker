import { useMemo, useState } from 'react'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { isQualifyingSession } from '../../domain/logic/qualifyingSession'
import { toISODate } from '../../domain/logic/weekUtils'
import { InlineEdit } from '../../components/InlineEdit'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Chip } from '../../components/Chip'
import { Panel } from '../../components/Panel'
import { sessionTitle } from '../session/sessionTitle'

type Tab = 'volume' | 'tasks' | 'records'

const TABS: { id: Tab; label: string }[] = [
  { id: 'volume', label: 'Activity' },
  { id: 'tasks', label: 'Task completion' },
  { id: 'records', label: 'Milestones' },
]

function countBy(ids: string[][]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const list of ids) for (const id of list) counts[id] = (counts[id] ?? 0) + 1
  return counts
}

function BarRows({
  rows,
  total,
}: {
  rows: { id: string; name: string; count: number }[]
  total: number
}) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="bar-row">
          <span className="bar-label">{r.name}</span>
          <span className="bar-count">
            {r.count} ({total === 0 ? 0 : Math.round((r.count / total) * 100)}%)
          </span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProgressScreen() {
  const sessions = useAppStore((s) => s.sessions)
  const skills = useAppStore((s) => s.skills)
  const hobbies = useAppStore((s) => s.hobbies)
  const routines = useAppStore((s) => s.routines)
  const records = useAppStore((s) => s.personalRecords)
  const [tab, setTab] = useState<Tab>('volume')
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)
  const hobbyById = new Map(hobbies.map((h) => [h.id, h]))
  const skillById = new Map(skills.map((s) => [s.id, s]))

  const qualifying = useMemo(() => sessions.filter(isQualifyingSession), [sessions])
  const countBySkill = useMemo(() => countBy(qualifying.map((s) => s.skillIds)), [qualifying])
  const countByHobby = useMemo(() => countBy(qualifying.map((s) => s.hobbyIds)), [qualifying])

  const skillRows = skills
    .filter((sk) => !sk.archived)
    .map((sk) => ({ id: sk.id, name: sk.name, count: countBySkill[sk.id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
  const hobbyRows = hobbies
    .filter((h) => !h.archived)
    .map((h) => ({ id: h.id, name: h.name, count: countByHobby[h.id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
  const untouchedSkills = skillRows.filter((r) => r.count === 0)

  const [recHobbyId, setRecHobbyId] = useState('')
  const [recSkillId, setRecSkillId] = useState('')
  const [recDescription, setRecDescription] = useState('')

  async function addRecord() {
    if (!recDescription.trim()) return
    await run({
      operation: 'record.create',
      payload: {
        hobbyId: recHobbyId || undefined,
        skillId: recSkillId || undefined,
        date: toISODate(new Date()),
        description: recDescription.trim(),
      },
    })
    setRecDescription('')
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Progress</h2>
        <span className="muted small">
          {qualifying.length} qualifying session{qualifying.length === 1 ? '' : 's'} · {records.length} milestone
          {records.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'volume' && (
        <>
          <Panel
            title="Activity by skill"
            icon="▤"
            count={skillRows.length}
            description="Session frequency per skill — how often you practiced, not how skilled you've become."
          >
            {skillRows.length === 0 ? <p className="empty-hint">No skills yet.</p> : <BarRows rows={skillRows} total={qualifying.length} />}
          </Panel>

          <Panel
            title="Activity by hobby"
            icon="▤"
            count={hobbyRows.length}
            description="Sessions tagged with each hobby."
          >
            {hobbyRows.length === 0 ? <p className="empty-hint">No hobbies yet.</p> : <BarRows rows={hobbyRows} total={qualifying.length} />}
          </Panel>

          <Panel
            title="Untouched skills"
            icon="◌"
            count={untouchedSkills.length}
            description="Skills with no qualifying session yet."
          >
            {untouchedSkills.length === 0 ? (
              <p className="ok-line m0">✓ Every skill has been practiced at least once.</p>
            ) : (
              <div className="row wrap">
                {untouchedSkills.map((r) => (
                  <Chip key={r.id} tone="skill">
                    {r.name}
                  </Chip>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === 'tasks' && (
        <Panel
          title="Task completion"
          icon="✓"
          count={qualifying.length}
          description="Completed vs. planned tasks for every finished session, newest first."
        >
          {qualifying.length === 0 && <p className="empty-hint">No finished sessions yet.</p>}
          <ul className="list-plain">
            {qualifying
              .slice()
              .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
              .map((s) => {
                const completed = s.taskEntries.filter((e) => e.status === 'completed').length
                const total = s.taskEntries.length
                const all = total > 0 && completed === total
                return (
                  <li key={s.id} className="list-row">
                    <span className={all ? 'dot dot-success' : 'dot dot-amber'} />
                    <span className="muted">{s.dateKey}</span>
                    <span className="grow bar-label">{sessionTitle(s, routines)}</span>
                    <span className="bar-count">
                      {completed}/{total}
                    </span>
                  </li>
                )
              })}
          </ul>
        </Panel>
      )}

      {tab === 'records' && (
        <>
          <Panel title="Record a milestone" icon="+">
            <div className="row">
              <select aria-label="Hobby" value={recHobbyId} onChange={(e) => setRecHobbyId(e.target.value)}>
                <option value="">Hobby (optional)…</option>
                {hobbies.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <select aria-label="Skill" value={recSkillId} onChange={(e) => setRecSkillId(e.target.value)}>
                <option value="">Skill (optional)…</option>
                {skills
                  .filter((sk) => !sk.archived)
                  .map((sk) => (
                    <option key={sk.id} value={sk.id}>
                      {sk.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="row mt-sm">
              <input
                type="text"
                aria-label="Milestone"
                placeholder="e.g. Implemented a working boss attack"
                value={recDescription}
                onChange={(e) => setRecDescription(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRecord()}
              />
              <button type="button" className="btn btn-primary" onClick={addRecord}>
                Save
              </button>
            </div>
          </Panel>

          <Panel title="Milestones" icon="★" count={records.length}>
            {records.length === 0 && <p className="empty-hint">No milestones recorded yet.</p>}
            <ul className="list-plain">
              {records
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((r) => (
                  <li key={r.id} className="list-row">
                    <span className="dot dot-violet" />
                    <span className="muted">{r.date}</span>
                    <span className="grow">
                      <InlineEdit
                        value={r.description}
                        ariaLabel="Milestone"
                        onSave={(description) => run({ operation: 'record.update', payload: { id: r.id, description } })}
                      />
                    </span>
                    {r.hobbyId && hobbyById.get(r.hobbyId) && <Chip tone="hobby">{hobbyById.get(r.hobbyId)!.name}</Chip>}
                    {r.skillId && skillById.get(r.skillId) && <Chip tone="skill">{skillById.get(r.skillId)!.name}</Chip>}
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete milestone ${r.description}`}
                      title="Delete"
                      onClick={() => setDeletingRecordId(r.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          </Panel>
        </>
      )}

      {deletingRecordId && (
        <ConfirmDialog
          title="Delete this milestone?"
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            await run({ operation: 'record.delete', payload: { id: deletingRecordId } })
            setDeletingRecordId(null)
          }}
          onCancel={() => setDeletingRecordId(null)}
        />
      )}
    </div>
  )
}
