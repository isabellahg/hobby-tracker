import { format, parseISO } from 'date-fns'
import type { DayMark } from '../../domain/types/derived'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeekGrid({ marks, todayKey }: { marks: DayMark[]; todayKey: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '0.5rem',
      }}
    >
      {marks.map((mark, i) => {
        const isToday = mark.date === todayKey
        const isFuture = mark.date > todayKey
        return (
          <div
            key={mark.date}
            className="card"
            style={{
              textAlign: 'center',
              padding: '0.6rem 0.25rem',
              borderColor: isToday ? 'var(--accent)' : 'var(--border)',
              opacity: isFuture ? 0.6 : 1,
            }}
          >
            <div className="muted" style={{ fontSize: '0.72rem' }}>
              {DAY_LABELS[i]}
            </div>
            <div style={{ fontSize: '0.95rem', margin: '0.15rem 0' }}>
              {format(parseISO(mark.date), 'd')}
            </div>
            <div
              aria-label={mark.hasMark ? 'Active day' : 'No activity'}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                margin: '0 auto',
                background: mark.hasMark ? 'var(--success)' : 'var(--border)',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
