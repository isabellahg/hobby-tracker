import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { computeDayMarks } from '../../domain/logic/dayMark'
import { computeWeekStreak } from '../../domain/logic/weekStreak'
import { addWeeks, getDayOfWeek, getWeekEnd, getWeekStart, toISODate } from '../../domain/logic/weekUtils'
import { WeekGrid } from '../../components/Calendar/WeekGrid'
import { EmptyState } from '../../components/EmptyState'
import { PlanningBoard } from './PlanningBoard'

export function HomeScreen() {
  const sessions = useAppStore((s) => s.sessions)
  const plan = useAppStore((s) => s.weeklyPlan)
  const routines = useAppStore((s) => s.routines)
  const navigate = useNavigate()
  const [weekOffset, setWeekOffset] = useState(0)

  const now = useMemo(() => new Date(), [])
  const todayKey = toISODate(now)
  const viewedWeekStart = useMemo(() => addWeeks(getWeekStart(now), weekOffset), [now, weekOffset])
  const range = useMemo(
    () => ({ start: toISODate(viewedWeekStart), end: toISODate(getWeekEnd(viewedWeekStart)) }),
    [viewedWeekStart],
  )

  const marks = useMemo(() => computeDayMarks(sessions, range), [sessions, range])
  const streak = useMemo(() => computeWeekStreak(sessions, now), [sessions, now])
  const activeDaysViewed = marks.filter((m) => m.hasMark).length

  const todayDow = getDayOfWeek(now)
  const todaysRoutineIds = plan.assignments[todayDow] ?? []
  const todaysRoutines = todaysRoutineIds
    .map((id) => routines.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r && !r.archived)

  async function startFromRoutine(routineId: string) {
    const result = await run({ operation: 'session.start', payload: { routineId } })
    if (result.success && result.changes[0]) navigate(`/session/${result.changes[0].id}`)
  }

  return (
    <div className="stack">
      <PlanningBoard />

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />

      <div className="page-header">
        <h2>
          Week of {format(viewedWeekStart, 'MMM d')}
          {weekOffset === 0 && ' (this week)'}
        </h2>
        <div className="row">
          <button type="button" className="btn" onClick={() => setWeekOffset((w) => w - 1)}>
            ← Previous
          </button>
          <button type="button" className="btn" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
            Today
          </button>
          <button type="button" className="btn" onClick={() => setWeekOffset((w) => w + 1)}>
            Next →
          </button>
        </div>
      </div>

      <WeekGrid marks={marks} todayKey={todayKey} />
      <p className="muted">{activeDaysViewed} active day(s) this week.</p>

      <div className="card row" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
        <div>
          <div className="muted">Current streak</div>
          <div style={{ fontSize: '1.6rem' }}>{streak.currentStreak} wk</div>
        </div>
        <div>
          <div className="muted">Longest streak</div>
          <div style={{ fontSize: '1.6rem' }}>{streak.longestStreak} wk</div>
        </div>
      </div>

      <div className="card">
        <h3>Today's suggestions</h3>
        {todaysRoutines.length === 0 ? (
          <EmptyState>
            Nothing planned for today — that's fine. Start anything from{' '}
            <a href="#/routines">Routines</a> whenever you like.
          </EmptyState>
        ) : (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {todaysRoutines.map((r) => (
              <button key={r.id} type="button" className="btn btn-primary" onClick={() => startFromRoutine(r.id)}>
                Start "{r.name}"
              </button>
            ))}
          </div>
        )}
        <p className="muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          Just a suggestion — starting anything else, or nothing at all, is equally fine.
        </p>
      </div>
    </div>
  )
}
