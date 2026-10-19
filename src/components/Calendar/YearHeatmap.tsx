import { useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import type { DayActivity } from '../../domain/logic/activity'
import { intensityLevel, yearWeeks } from '../../domain/logic/activity'
import { dayTitle } from './dayTitle'

const ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

/** The whole year at a glance, one square per day (GitHub-style). */
export function YearHeatmap({
  year,
  byDate,
  selected,
  todayKey,
  onSelect,
}: {
  year: number
  byDate: Map<string, DayActivity>
  selected?: string
  todayKey: string
  onSelect: (date: string) => void
}) {
  const weeks = yearWeeks(year)
  const scroller = useRef<HTMLDivElement>(null)

  // On a narrow screen the year scrolls sideways; start at today's end of it.
  useEffect(() => {
    const el = scroller.current
    if (el && todayKey.startsWith(String(year))) el.scrollLeft = el.scrollWidth
  }, [year, todayKey])

  return (
    <div className="heatmap-scroll" ref={scroller}>
      <div className="heatmap" style={{ gridTemplateColumns: `auto repeat(${weeks.length}, minmax(9px, 1fr))` }}>
        <span className="heatmap-corner" />
        {weeks.map((week, w) => {
          const firstOfMonth = week.find((d) => d?.endsWith('-01'))
          return (
            <span key={`m${w}`} className="heatmap-month">
              {firstOfMonth ? format(parseISO(firstOfMonth), 'MMM') : ''}
            </span>
          )
        })}
        {ROW_LABELS.map((label, row) => (
          <HeatmapRow key={row} label={label} row={row} weeks={weeks} byDate={byDate} selected={selected} todayKey={todayKey} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function HeatmapRow({
  label,
  row,
  weeks,
  byDate,
  selected,
  todayKey,
  onSelect,
}: {
  label: string
  row: number
  weeks: (string | null)[][]
  byDate: Map<string, DayActivity>
  selected?: string
  todayKey: string
  onSelect: (date: string) => void
}) {
  return (
    <>
      <span className="heatmap-day-label">{label}</span>
      {weeks.map((week, w) => {
        const date = week[row]
        if (!date) return <span key={w} className="heat-cell is-pad" />
        const day = byDate.get(date)
        const classes = ['heat-cell', `lvl-${intensityLevel(day)}`]
        if (date === todayKey) classes.push('is-today')
        if (date === selected) classes.push('is-selected')
        if (date > todayKey) classes.push('is-future')
        return (
          <button
            key={w}
            type="button"
            className={classes.join(' ')}
            title={dayTitle(date, day)}
            aria-label={dayTitle(date, day)}
            onClick={() => onSelect(date)}
          />
        )
      })}
    </>
  )
}

export function HeatLegend() {
  return (
    <div className="heat-legend" aria-label="Less to more practice">
      <span>less</span>
      {[0, 1, 2, 3, 4].map((l) => (
        <span key={l} className={`heat-cell lvl-${l}`} />
      ))}
      <span>more</span>
      <span className="muted">· &lt;30m · &lt;1h · &lt;2h · 2h+</span>
    </div>
  )
}
