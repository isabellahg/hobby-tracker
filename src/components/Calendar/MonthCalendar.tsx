import { format } from 'date-fns'
import type { DayActivity } from '../../domain/logic/activity'
import { intensityLevel, monthWeeks } from '../../domain/logic/activity'
import { compactDuration } from '../../lib/format'
import { dayTitle } from './dayTitle'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** A month of days shaded by how much you practised; click a day to see it. */
export function MonthCalendar({
  monthStart,
  byDate,
  selected,
  todayKey,
  onSelect,
}: {
  monthStart: Date
  byDate: Map<string, DayActivity>
  selected?: string
  todayKey: string
  onSelect: (date: string) => void
}) {
  return (
    <div className="month-cal" role="grid" aria-label={format(monthStart, 'MMMM yyyy')}>
      {DAY_LABELS.map((d) => (
        <div key={d} className="month-cal-head" role="columnheader">
          {d}
        </div>
      ))}
      {monthWeeks(monthStart)
        .flat()
        .map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="cal-day is-pad" aria-hidden="true" />
          const day = byDate.get(date)
          const classes = ['cal-day', `lvl-${intensityLevel(day)}`]
          if (date === todayKey) classes.push('is-today')
          if (date === selected) classes.push('is-selected')
          if (date > todayKey) classes.push('is-future')
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              className={classes.join(' ')}
              title={dayTitle(date, day)}
              aria-label={dayTitle(date, day)}
              aria-selected={date === selected}
              onClick={() => onSelect(date)}
            >
              <span className="cal-num">{Number(date.slice(8))}</span>
              {day && <span className="cal-time">{compactDuration(day.sec)}</span>}
            </button>
          )
        })}
    </div>
  )
}
