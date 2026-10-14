export function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <div
        style={{
          flex: 1,
          height: 8,
          borderRadius: 999,
          background: 'var(--bg-elevated-2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'var(--accent)',
            transition: 'width 0.2s ease',
          }}
        />
      </div>
      <span className="muted" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
        {completed}/{total}
      </span>
    </div>
  )
}
