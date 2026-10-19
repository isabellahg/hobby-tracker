export interface ChartBar {
  key: string
  label: string
  /** Second label line, e.g. the month under a week's day number. */
  sublabel?: string
  value: number
  title: string
  current?: boolean
}

/** Vertical bars for a series of periods; the newest sits on the right. */
export function BarChart({
  bars,
  formatValue,
  onSelect,
}: {
  bars: ChartBar[]
  formatValue: (value: number) => string
  onSelect?: (key: string) => void
}) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <div className="bar-chart" role="list">
      {bars.map((b) => (
        <button
          key={b.key}
          type="button"
          role="listitem"
          className={b.current ? 'bar-col is-current' : 'bar-col'}
          title={b.title}
          aria-label={b.title}
          disabled={!onSelect}
          onClick={() => onSelect?.(b.key)}
        >
          <span className="bar-col-value">{b.value > 0 ? formatValue(b.value) : ''}</span>
          <span className="bar-col-track">
            <span className="bar-col-fill" style={{ height: `${(b.value / max) * 100}%` }} />
          </span>
          <span className="bar-col-label">{b.label}</span>
          <span className="bar-col-sublabel">{b.sublabel ?? ''}</span>
        </button>
      ))}
    </div>
  )
}
