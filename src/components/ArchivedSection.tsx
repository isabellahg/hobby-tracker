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
    <details className="card archived">
      <summary>
        {title} ({items.length})
      </summary>
      <ul className="list-plain">
        {items.map((item) => (
          <li key={item.id} className="list-row">
            <span className="dot" />
            <span className="muted grow">{item.label}</span>
            <button type="button" className="btn" onClick={() => onRestore(item.id)}>
              Restore
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
