import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { isQualifyingSession } from '../../domain/logic/qualifyingSession'
import { computeWeekStreak } from '../../domain/logic/weekStreak'
import { countSessionsForTask } from '../../domain/logic/taskProgress'
import type { Session } from '../../domain/types/session'
import { Chip } from '../../components/Chip'
import { InlineEdit } from '../../components/InlineEdit'
import { MediaStrip } from '../../components/MediaStrip'
import { TaskTagPicker } from '../../components/TaskTagPicker'
import { sessionTitle } from './sessionTitle'
import { EntryLine } from './EntryLine'
import { formatDuration } from '../../lib/format'

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'success' }) {
  return (
    <div className={tone ? `stat-tile stat-tile-${tone}` : 'stat-tile'}>
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </div>
  )
}

export function SessionSummaryCard({ session }: { session: Session }) {
  const allSessions = useAppStore((s) => s.sessions)
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const records = useAppStore((s) => s.personalRecords)
  const taskDefs = useAppStore((s) => s.taskDefs)
  const routines = useAppStore((s) => s.routines)
  const [editingTags, setEditingTags] = useState(false)

  const completed = session.taskEntries.filter((e) => e.status === 'completed')
  const unfinished = session.taskEntries.filter((e) => e.status === 'pending')
  const total = session.taskEntries.length
  const pct = total === 0 ? 0 : Math.round((completed.length / total) * 100)

  const sameDayOtherQualifying = allSessions.some(
    (s) => s.id !== session.id && s.dateKey === session.dateKey && isQualifyingSession(s),
  )
  const markIsNew = isQualifyingSession(session) && !sameDayOtherQualifying

  const referenceNow = session.finishedAt ? new Date(session.finishedAt) : new Date()
  const streak = computeWeekStreak(allSessions, referenceNow)

  const achievedRecords = records.filter((r) => r.sessionId === session.id)
  const sessionTaskDefIds = new Set(session.taskEntries.map((e) => e.taskDefId).filter(Boolean))
  const ongoingTasks = taskDefs.filter((t) => t.kind === 'ongoing' && !t.archived && sessionTaskDefIds.has(t.id))

  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((s) => !s.archived)
  const hasTags = session.hobbyIds.length + session.skillIds.length > 0
  const toggleId = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  function setTags(hobbyIds: string[], skillIds: string[]) {
    run({ operation: 'session.setTags', payload: { sessionId: session.id, hobbyIds, skillIds } })
  }

  const started = parseISO(session.startedAt)
  const when = session.finishedAt
    ? `${format(started, 'EEEE d MMMM')} · ${format(started, 'HH:mm')}–${format(parseISO(session.finishedAt), 'HH:mm')}`
    : format(started, 'EEEE d MMMM')

  return (
    <div className="summary">
      <section className="summary-hero">
        <div className="summary-eyebrow">✓ Session complete</div>
        <h2 className="summary-title">
          <InlineEdit
            value={sessionTitle(session, routines)}
            ariaLabel="Session name"
            onSave={(name) => run({ operation: 'session.rename', payload: { sessionId: session.id, name } })}
          />
        </h2>
        <div className="summary-when">{when}</div>

        <div className="stat-tiles">
          <StatTile label="Time" value={session.durationSec !== undefined ? formatDuration(session.durationSec) : '—'} />
          <StatTile label="Tasks" value={`${completed.length}/${total}`} sub={total ? `${pct}% done` : 'free-form'} />
          <StatTile
            label="Today"
            value={markIsNew ? 'Marked' : '✓'}
            sub={markIsNew ? 'new mark earned' : 'already marked'}
            tone={markIsNew ? 'success' : undefined}
          />
          <StatTile label="Streak" value={`${streak.currentStreak} wk`} sub={`${streak.weekActiveDays}/7 days this week`} />
        </div>
        {total > 0 && (
          <div className="bar-track summary-bar" aria-hidden="true">
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </section>

      {achievedRecords.length > 0 && (
        <section className="summary-card">
          <h3>★ Achievements</h3>
          <ul className="list-plain">
            {achievedRecords.map((r) => (
              <li key={r.id} className="list-row">
                <span className="dot dot-amber" />
                {r.description}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="summary-card">
        <h3>What you did</h3>
        {total === 0 && <p className="empty-hint">A free-form session — no checklist.</p>}
        <ul className="check-list">
          {completed.map((e) => (
            <li key={e.id} className="is-checked">
              <span className="check-mark" aria-hidden="true">
                ✓
              </span>
              <div className="grow">
                <EntryLine entry={e} entries={session.taskEntries} />
                <MediaStrip taskDefId={e.taskDefId} />
              </div>
            </li>
          ))}
          {unfinished.map((e) => (
            <li key={e.id}>
              <span className="check-mark" aria-hidden="true">
                ○
              </span>
              <div className="grow muted">
                <EntryLine entry={e} entries={session.taskEntries} />
              </div>
            </li>
          ))}
        </ul>
        {unfinished.length > 0 && (
          <p className="desc m0">Anything from your backlog you didn't get to is still there for next time.</p>
        )}
      </section>

      <section className="summary-card">
        <div className="row row-between">
          <h3 className="m0">Practised</h3>
          <button type="button" className="icon-btn" onClick={() => setEditingTags((v) => !v)}>
            {editingTags ? 'done' : hasTags ? '✎ tags' : '+ tag it'}
          </button>
        </div>
        {hasTags ? (
          <div className="row wrap mt-sm">
            {session.hobbyIds.map((id) => (
              <Chip key={id} tone="hobby">
                {allHobbies.find((h) => h.id === id)?.name ?? '?'}
              </Chip>
            ))}
            {session.skillIds.map((id) => (
              <Chip key={id} tone="skill">
                {allSkills.find((s) => s.id === id)?.name ?? '?'}
              </Chip>
            ))}
          </div>
        ) : (
          !editingTags && <p className="empty-hint">Not tagged yet.</p>
        )}
        {editingTags && (
          <div className="mt-sm">
            <TaskTagPicker
              hobbies={hobbies}
              skills={skills}
              selectedHobbyIds={session.hobbyIds}
              selectedSkillIds={session.skillIds}
              onToggleHobby={(id) => setTags(toggleId(session.hobbyIds, id), session.skillIds)}
              onToggleSkill={(id) => setTags(session.hobbyIds, toggleId(session.skillIds, id))}
            />
          </div>
        )}
      </section>

      {ongoingTasks.map((task) => {
        const count = countSessionsForTask(allSessions, task.id)
        return (
          <section key={task.id} className="summary-card summary-card-ongoing">
            <div className="row row-between">
              <h3 className="m0">{task.label}</h3>
              <span className="list-row-meta">
                {count} session{count === 1 ? '' : 's'} so far
              </span>
            </div>
            <div className="row small mt-sm">
              <span className="muted">Next:</span>
              <InlineEdit
                value={task.nextAction ?? ''}
                placeholder="set a next action"
                ariaLabel={`Next action for ${task.label}`}
                onSave={(nextAction) => run({ operation: 'taskDef.update', payload: { id: task.id, nextAction } })}
              />
            </div>
          </section>
        )
      })}

      <div className="row">
        <Link to="/" className="btn btn-primary">
          Back to Home
        </Link>
      </div>
    </div>
  )
}
