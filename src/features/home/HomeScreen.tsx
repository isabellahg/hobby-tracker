import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { computeDayMarks } from '../../domain/logic/dayMark'
import { computeWeekStreak } from '../../domain/logic/weekStreak'
import { addWeeks, getDayOfWeek, getWeekEnd, getWeekStart, toISODate } from '../../domain/logic/weekUtils'
import { WeekGrid } from '../../components/Calendar/WeekGrid'
import { Panel } from '../../components/Panel'
import { sessionTitle } from '../session/sessionTitle'
import { PlanningBoard } from './PlanningBoard'

function formatMinutes(sec: number): string {
  return sec < 60 ? '<1m' : `${Math.round(sec / 60)}m`
}

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

  const recent = sessions
    .filter((s) => s.state === 'finished')
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 5)

  async function startFromRoutine(routineId: string) {
    const result = await run({ operation: 'session.start', payload: { routineId } })
    if (result.success && result.changes[0]) navigate(`/session/${result.changes[0].id}`)
  }

  return (
    <div className="home-layout">
      <PlanningBoard />

      <aside className="home-aside stack">
        <Panel
          title={`Week of ${format(viewedWeekStart, 'MMM d')}`}
          icon="▦"
          actions={
            <>
              <button type="button" className="icon-btn" aria-label="Previous week" onClick={() => setWeekOffset((w) => w - 1)}>
                ‹
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
                title="Back to this week"
              >
                today
              </button>
              <button type="button" className="icon-btn" aria-label="Next week" onClick={() => setWeekOffset((w) => w + 1)}>
                ›
              </button>
            </>
          }
        >
          <WeekGrid marks={marks} todayKey={todayKey} />
          <p className="desc m0">
            {activeDaysViewed} active day{activeDaysViewed === 1 ? '' : 's'}
            {weekOffset === 0 ? ' this week' : ' that week'}.
          </p>
        </Panel>

        <Panel title="Consistency" icon="↯">
          <div className="stat-row">
            <div>
              <div className="stat-label">Current streak</div>
              <div className="stat-value">{streak.currentStreak} wk</div>
            </div>
            <div>
              <div className="stat-label">Longest</div>
              <div className="stat-value">{streak.longestStreak} wk</div>
            </div>
            <div>
              <div className="stat-label">This week</div>
              <div className="stat-value">{streak.weekActiveDays}/7</div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Today's suggestions"
          icon="☼"
          count={todaysRoutines.length}
          description="Just a suggestion — starting anything else, or nothing at all, is equally fine."
        >
          {todaysRoutines.length === 0 ? (
            <p className="empty-hint">
              Nothing planned for today. Start anything from <a href="#/routines">Routines</a>.
            </p>
          ) : (
            <div className="row wrap">
              {todaysRoutines.map((r) => (
                <button key={r.id} type="button" className="btn btn-primary" onClick={() => startFromRoutine(r.id)}>
                  ▶ {r.name}
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent sessions" icon="≡" count={recent.length}>
          {recent.length === 0 ? (
            <p className="empty-hint">No finished sessions yet.</p>
          ) : (
            <ul className="list-plain">
              {recent.map((s) => (
                <li key={s.id} className="list-row">
                  <span className="dot dot-success" />
                  <a href={`#/session/${s.id}`} className="grow bar-label">
                    {sessionTitle(s, routines)}
                  </a>
                  <span className="list-row-meta">
                    {s.durationSec !== undefined ? formatMinutes(s.durationSec) : s.dateKey.slice(5)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </aside>
    </div>
  )
}
