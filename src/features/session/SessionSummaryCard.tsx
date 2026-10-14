import { Link } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { isQualifyingSession } from '../../domain/logic/qualifyingSession'
import { computeWeekStreak } from '../../domain/logic/weekStreak'
import type { Session } from '../../domain/types/session'
import { Chip } from '../../components/Chip'

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
  const projects = useAppStore((s) => s.projects)

  const completed = session.taskEntries.filter((e) => e.status === 'completed')
  const unfinished = session.taskEntries.filter((e) => e.status === 'pending')

  const sameDayOtherQualifying = allSessions.some(
    (s) => s.id !== session.id && s.dateKey === session.dateKey && isQualifyingSession(s),
  )
  const markIsNew = isQualifyingSession(session) && !sameDayOtherQualifying

  const referenceNow = session.finishedAt ? new Date(session.finishedAt) : new Date()
  const streak = computeWeekStreak(allSessions, referenceNow)

  const achievedRecords = records.filter((r) => r.sessionId === session.id)
  const project = session.projectId ? projects.find((p) => p.id === session.projectId) : undefined

  const hobbyNames = session.hobbyIds.map((id) => hobbies.find((h) => h.id === id)?.name).filter(Boolean)
  const skillNames = session.skillIds.map((id) => skills.find((s) => s.id === id)?.name).filter(Boolean)

  return (
    <div className="stack">
      <h2>Session complete</h2>

      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted">Tasks completed</div>
            <div style={{ fontSize: '1.4rem' }}>
              {completed.length}/{session.taskEntries.length}
            </div>
          </div>
          {session.durationSec !== undefined && (
            <div>
              <div className="muted">Time invested</div>
              <div style={{ fontSize: '1.4rem' }}>{formatDuration(session.durationSec)}</div>
            </div>
          )}
          <div>
            <div className="muted">Activity</div>
            <div style={{ fontSize: '1.4rem' }}>{markIsNew ? 'Mark earned 🎉' : 'Already marked today'}</div>
          </div>
        </div>
      </div>

      {achievedRecords.length > 0 && (
        <div className="card">
          <h3>Achievements</h3>
          <ul>
            {achievedRecords.map((r) => (
              <li key={r.id}>{r.description}</li>
            ))}
          </ul>
        </div>
      )}

      {(hobbyNames.length > 0 || skillNames.length > 0) && (
        <div className="card">
          <h3>Practiced</h3>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {hobbyNames.map((n) => (
              <Chip key={`h-${n}`}>{n}</Chip>
            ))}
            {skillNames.map((n) => (
              <Chip key={`s-${n}`}>{n}</Chip>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="card">
          <h3>Completed</h3>
          <ul>
            {completed.map((e) => (
              <li key={e.id}>{e.label}</li>
            ))}
          </ul>
        </div>
      )}

      {unfinished.length > 0 && (
        <div className="card">
          <h3>Unfinished</h3>
          <ul>
            {unfinished.map((e) => (
              <li key={e.id}>{e.label}</li>
            ))}
          </ul>
          <p className="muted">
            {session.projectId
              ? 'Carried forward to the project.'
              : "Not tied to a project — you can start a new session and these won't auto-appear."}
          </p>
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

      {project && (
        <div className="card">
          <h3>Next action — {project.name}</h3>
          <p>{project.nextAction || 'Not set yet.'}</p>
          <Link to={`/projects/${project.id}`} className="btn">
            View project
          </Link>
        </div>
      )}

      <div className="row">
        <Link to="/" className="btn btn-primary">
          Back to Home
        </Link>
        <Link to="/routines" className="btn">
          Start another routine
        </Link>
      </div>
    </div>
  )
}
