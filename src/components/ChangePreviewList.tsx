import type { ChangeLine } from '../domain/operations/diff'

const COLOR_BY_TYPE: Record<ChangeLine['changeType'], string> = {
  created: 'var(--success)',
  updated: 'var(--warn)',
  deleted: 'var(--danger)',
}

/** Renders a human-readable diff of records a pending operation would change. Shared by the LLM Import screen and the file-import merge/replace preview. */
export function ChangePreviewList({ lines }: { lines: ChangeLine[] }) {
  if (lines.length === 0) {
    return <p className="muted">No changes.</p>
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {lines.map((line, i) => (
        <li
          key={`${line.store}-${line.id}-${i}`}
          style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}
        >
          <span style={{ color: COLOR_BY_TYPE[line.changeType], marginRight: '0.5rem' }}>●</span>
          {line.label}
        </li>
      ))}
    </ul>
  )
}
