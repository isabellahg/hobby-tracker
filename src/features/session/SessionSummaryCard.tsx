import { Link } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { isQualifyingSession } from '../../domain/logic/qualifyingSession'
import { computeWeekStreak } from '../../domain/logic/weekStreak'
import { countSessionsForTask } from '../../domain/logic/taskProgress'
import type { Session } from '../../domain/types/session'
import { Chip } from '../../components/Chip'
import { InlineEdit } from '../../components/InlineEdit'
import { sessionTitle } from './sessionTitle'

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function SessionSummaryCard({ session }: { session: Session }) {
  const allSessions = useAppStore((s) => s.sessions)
  const hobbies = useAppStore((s) => s.hobbies)
  const skills = useAppStore((s) => s.skills)
  const records = useAppStore((s) => s.personalRecords)
  const taskDefs = useAppStore((s) => s.taskDefs)
  const routines = useAppStore((s) => s.routines)

  const completed = session.taskEntries.filter((e) => e.status === 'completed')
  const unfinished = session.taskEntries.filter((e) => e.status === 'pending')

  const sameDayOtherQualifying = allSessions.some(
    (s) => s.id !== session.id && s.dateKey === session.dateKey && isQualifyingSession(s),
  )
  const markIsNew = isQualifyingSession(session) && !sameDayOtherQualifying

  const referenceNow = session.finishedAt ? new Date(session.finishedAt) : new Date()
  const streak = computeWeekStreak(allSessions, referenceNow)

  const achievedRecords = records.filter((r) => r.sessionId === session.id)
  const sessionTaskDefIds = new Set(session.taskEntries.map((e) => e.taskDefId).filter(Boolean))
  const ongoingTasks = taskDefs.filter((t) => t.kind === 'ongoing' && !t.archived && sessionTaskDefIds.has(t.id))

  const hobbyNames = session.hobbyIds.map((id) => hobbies.find((h) => h.id === id)?.name).filter(Boolean)
  const skillNames = session.skillIds.map((id) => skills.find((s) => s.id === id)?.name).filter(Boolean)

  return (
    <div className="stack">
      <div>
        <div className="page-subtitle">
          Session complete
        </div>
        <h2>
          <InlineEdit
            value={sessionTitle(session, routines)}
            ariaLabel="Session name"
            onSave={(name) => run({ operation: 'session.rename', payload: { sessionId: session.id, name } })}
          />
        </h2>
      </div>

      <div className="card">
        <div className="stat-row">
          <div>
            <div className="stat-label">Tasks completed</div>
            <div className="stat-value">
              {completed.length}/{session.taskEntries.length}
            </div>
          </div>
          {session.durationSec !== undefined && (
            <div>
              <div className="stat-label">Time invested</div>
              <div className="stat-value">{formatDuration(session.durationSec)}</div>
            </div>
          )}
          <div>
            <div className="stat-label">Activity</div>
            <div className="stat-value">{markIsNew ? 'Mark earned 🎉' : 'Already marked today'}</div>
          </div>
        </div>
      </div>

      {achievedRecords.length > 0 && (
        <div className="card">
          <h3>Achievements</h3>
          <ul className="list-bullets">
            {achievedRecords.map((r) => (
              <li key={r.id}>{r.description}</li>
            ))}
          </ul>
        </div>
      )}

      {(hobbyNames.length > 0 || skillNames.length > 0) && (
        <div className="card">
          <h3>Practiced</h3>
          <div className="row wrap">
            {hobbyNames.map((n) => (
              <Chip key={`h-${n}`} tone="hobby">{n}</Chip>
            ))}
            {skillNames.map((n) => (
              <Chip key={`s-${n}`} tone="skill">{n}</Chip>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="card">
          <h3>Completed</h3>
          <ul className="list-bullets">
            {completed.map((e) => (
              <li key={e.id}>{e.label}</li>
            ))}
          </ul>
        </div>
      )}

      {unfinished.length > 0 && (
        <div className="card">
          <h3>Unfinished</h3>
          <ul className="list-bullets">
            {unfinished.map((e) => (
              <li key={e.id}>{e.label}</li>
            ))}
          </ul>
          <p className="muted">Anything from your backlog you didn't get to is still there for next time.</p>
        </div>
      )}

      {ongoingTasks.length > 0 && (
        <div className="card stack">
          <h3 className="m0">Ongoing</h3>
          {ongoingTasks.map((task) => {
            const count = countSessionsForTask(allSessions, task.id)
            return (
              <div key={task.id}>
                <strong>{task.label}</strong>{' '}
                <span className="muted">
                  · {count} session{count === 1 ? '' : 's'}
                </span>
                <div className="row small">
                  <span className="muted">Next:</span>
                  <InlineEdit
                    value={task.nextAction ?? ''}
                    placeholder="set a next action"
                    ariaLabel={`Next action for ${task.label}`}
                    onSave={(nextAction) => run({ operation: 'taskDef.update', payload: { id: task.id, nextAction } })}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card">
        <h3>Consistency</h3>
        <p>
          Current streak: <strong>{streak.currentStreak}</strong> week(s) · Longest:{' '}
          <strong>{streak.longestStreak}</strong> · Active days this week:{' '}
          <strong>{streak.weekActiveDays}</strong>
        </p>
      </div>

      <div className="row">
        <Link to="/" className="btn btn-primary">
          Back to Home
        </Link>
      </div>
    </div>
  )
}
