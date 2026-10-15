/** A collapsed list of archived items, each with a Restore button. Renders nothing when empty. */
export function ArchivedSection({
  items,
  onRestore,
  title = 'Archived',
}: {
  items: { id: string; label: string }[]
  onRestore: (id: string) => void
  title?: string
}) {
  if (items.length === 0) return null
  return (
    <details className="card">
      <summary className="muted" style={{ cursor: 'pointer' }}>
        {title} ({items.length})
      </summary>
      <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }} className="stack">
        {items.map((item) => (
          <li key={item.id} className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">{item.label}</span>
            <button type="button" className="btn" onClick={() => onRestore(item.id)}>
              Restore
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
