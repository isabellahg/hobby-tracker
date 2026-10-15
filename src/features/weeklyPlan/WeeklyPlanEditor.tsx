import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import type { DayOfWeek } from '../../domain/types/common'

const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
  6: 'Sunday',
}

export function WeeklyPlanEditor() {
  const plan = useAppStore((s) => s.weeklyPlan)
  const allRoutines = useAppStore((s) => s.routines)
  const routines = allRoutines.filter((r) => !r.archived)

  async function toggleRoutineForDay(day: DayOfWeek, routineId: string) {
    const current = plan.assignments[day] ?? []
    const next = current.includes(routineId)
      ? current.filter((id) => id !== routineId)
      : [...current, routineId]
    await run({ operation: 'weeklyPlan.update', payload: { set: [{ day, routineIds: next }] } })
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Weekly Plan</h2>
      </div>
      <p className="desc m0">
        Purely advisory. Assigning a routine to a day only shows it as a suggestion on Home — it never
        blocks starting any routine, any day, or penalizes skipping it.
      </p>

      {routines.length === 0 && <p className="muted">Create a routine first to plan it.</p>}

      <div className="stack stack-sm">
        {([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map((day) => (
          <div key={day} className="card card-tight">
            <h3>{DAY_LABELS[day]}</h3>
            <div className="row wrap">
              {routines.map((r) => {
                const active = (plan.assignments[day] ?? []).includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="pill"
                    aria-pressed={active}
                    onClick={() => toggleRoutineForDay(day, r.id)}
                  >
                    {r.name}
                  </button>
                )
              })}
              {routines.length > 0 && (plan.assignments[day] ?? []).length === 0 && (
                <span className="empty-hint">Nothing suggested</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
