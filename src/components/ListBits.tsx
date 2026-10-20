import { useState } from 'react'
import { run } from '../state/actions'
import { useAppStore } from '../state/store'
import { normalizeFrequency, PERIOD_LABEL, RATING_LABEL, type HabitProgress } from '../domain/logic/habits'
import { HABIT_STATUS_ORDER, isHabit, itemStatus, STATUS_ORDER, statusLabel } from '../domain/logic/listItems'
import type { HabitFrequency, HabitPeriod, ItemStatus, TaskDef } from '../domain/types/taskDef'

const PERIOD_SHORT: Record<HabitPeriod, string> = { day: 'day', week: 'wk', month: 'mo' }

/** A bar filled by this period's count, with ticks at the minimum and the average; full = amazing. */
export function HabitMeter({ progress }: { progress: HabitProgress }) {
  const { count, freq, rating } = progress
  const max = Math.max(freq.amazing, count, 1)
  const pct = (n: number) => `${(n / max) * 100}%`
  const title = `${count} this ${PERIOD_LABEL[freq.period]} — ${RATING_LABEL[rating]} (min ${freq.min} · avg ${freq.avg} · amazing ${freq.amazing})`
  return (
    <span className={`habit-meter rating-${rating}`} title={title}>
      <span className="habit-meter-bar" aria-hidden="true">
        <span className="habit-meter-fill" style={{ width: pct(count) }} />
        <span className="habit-meter-tick" style={{ left: pct(freq.min) }} />
        <span className="habit-meter-tick" style={{ left: pct(freq.avg) }} />
      </span>
      <span className="habit-meter-text">
        {count}/{freq.avg}·{PERIOD_SHORT[freq.period]}
      </span>
    </span>
  )
}

/** Compact state picker for a list item or habit. */
export function StatusSelect({ task }: { task: TaskDef }) {
  const habit = isHabit(task)
  const current = itemStatus(task)
  return (
    <select
      className={`status-select status-${current}`}
      aria-label={`State of ${task.label}`}
      value={current}
      onChange={(e) => run({ operation: 'taskDef.setStatus', payload: { id: task.id, status: e.target.value as ItemStatus } })}
    >
      {(habit ? HABIT_STATUS_ORDER : STATUS_ORDER).map((s) => (
        <option key={s} value={s}>
          {statusLabel(s, habit)}
        </option>
      ))}
    </select>
  )
}

/** "quiet 4w" with one-tap pause / drop. */
export function StaleNudge({ task, weeks }: { task: TaskDef; weeks: number }) {
  const set = (status: ItemStatus) => run({ operation: 'taskDef.setStatus', payload: { id: task.id, status } })
  return (
    <span className="stale-nudge" title={`Ongoing for ${weeks} weeks without being touched — pause it or let it go?`}>
      quiet {weeks}w ·
      <button type="button" className="link-btn" onClick={() => set('paused')}>
        pause
      </button>
      /
      <button type="button" className="link-btn" onClick={() => set('abandoned')}>
        drop
      </button>
    </span>
  )
}

/** Period + min / avg / amazing, saved when a field is left. */
export function FrequencyEditor({ task }: { task: TaskDef }) {
  const saved = task.habit
  const [draft, setDraft] = useState<HabitFrequency | null>(null)
  const freq = draft ?? saved ?? { period: 'week', min: 1, avg: 2, amazing: 3 }

  function save(next: HabitFrequency) {
    setDraft(null)
    const clean = normalizeFrequency(next)
    if (JSON.stringify(clean) === JSON.stringify(saved)) return
    run({ operation: 'taskDef.update', payload: { id: task.id, habit: clean } })
  }

  function numberField(key: 'min' | 'avg' | 'amazing', label: string) {
    return (
      <label className="freq-field">
        {label}
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={freq[key]}
          onChange={(e) => setDraft({ ...freq, [key]: Number(e.target.value) || 1 })}
          onBlur={() => draft && save(draft)}
          onKeyDown={(e) => e.key === 'Enter' && draft && save(draft)}
        />
      </label>
    )
  }

  return (
    <div className="freq-editor">
      <select
        aria-label={`How often ${task.label} is counted`}
        value={freq.period}
        onChange={(e) => save({ ...freq, period: e.target.value as HabitPeriod })}
      >
        <option value="day">per day</option>
        <option value="week">per week</option>
        <option value="month">per month</option>
      </select>
      {numberField('min', 'min')}
      {numberField('avg', 'avg')}
      {numberField('amazing', 'amazing')}
    </div>
  )
}

/** Where a task lives — the plain backlog, Habits, or one of your lists — and a way to move it. */
export function MoveToSelect({ task }: { task: TaskDef }) {
  const lists = useAppStore((s) => s.lists).filter((l) => !l.archived || l.id === task.listId)
  const current = isHabit(task) ? 'habits' : (task.listId ?? 'backlog')
  return (
    <select
      className="move-select"
      aria-label={`Where ${task.label} lives`}
      title="Move to the backlog, Habits, or a list"
      value={current}
      onChange={(e) => run({ operation: 'taskDef.moveTo', payload: { id: task.id, target: e.target.value } })}
    >
      <option value="backlog">☰ Backlog</option>
      <option value="habits">↻ Habits</option>
      {lists
        .sort((a, b) => a.order - b.order)
        .map((l) => (
          <option key={l.id} value={l.id}>
            ▤ {l.name}
          </option>
        ))}
    </select>
  )
}
