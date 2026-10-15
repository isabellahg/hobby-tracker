import { format, parseISO } from 'date-fns'
import type { DayMark } from '../../domain/types/derived'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeekGrid({ marks, todayKey }: { marks: DayMark[]; todayKey: string }) {
  return (
    <div className="week-grid">
      {marks.map((mark, i) => {
        const classes = ['week-day']
        if (mark.date === todayKey) classes.push('is-today')
        if (mark.date > todayKey) classes.push('is-future')
        return (
          <div key={mark.date} className={classes.join(' ')}>
            <div className="week-day-label">{DAY_LABELS[i]}</div>
            <div className="week-day-num">{format(parseISO(mark.date), 'd')}</div>
            <div
              aria-label={mark.hasMark ? 'Active day' : 'No activity'}
              className={mark.hasMark ? 'dot dot-success' : 'dot'}
            />
          </div>
        )
      })}
    </div>
  )
}
