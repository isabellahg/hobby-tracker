import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import type { DayMark } from '../../domain/types/derived'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Each day opens that date in Progress → Calendar. */
export function WeekGrid({ marks, todayKey }: { marks: DayMark[]; todayKey: string }) {
  return (
    <div className="week-grid">
      {marks.map((mark, i) => {
        const classes = ['week-day']
        if (mark.date === todayKey) classes.push('is-today')
        if (mark.date > todayKey) classes.push('is-future')
        return (
          <Link
            key={mark.date}
            to={`/progress?tab=calendar&date=${mark.date}`}
            className={classes.join(' ')}
            title="Open in the calendar"
          >
            <div className="week-day-label">{DAY_LABELS[i]}</div>
            <div className="week-day-num">{format(parseISO(mark.date), 'd')}</div>
            <div
              aria-label={mark.hasMark ? 'Active day' : 'No activity'}
              className={mark.hasMark ? 'dot dot-success' : 'dot'}
            />
          </Link>
        )
      })}
    </div>
  )
}
