import type { ChangeLine } from '../domain/operations/diff'

const DOT_BY_TYPE: Record<ChangeLine['changeType'], string> = {
  created: 'dot dot-success',
  updated: 'dot dot-amber',
  deleted: 'dot dot-danger',
}

/** Renders a human-readable diff of records a pending operation would change. Shared by the LLM Import screen and the file-import merge/replace preview. */
export function ChangePreviewList({ lines }: { lines: ChangeLine[] }) {
  if (lines.length === 0) {
    return <p className="muted">No changes.</p>
  }
  return (
    <ul className="list-plain">
      {lines.map((line, i) => (
        <li key={`${line.store}-${line.id}-${i}`} className="list-row">
          <span className={DOT_BY_TYPE[line.changeType]} />
          <span className="grow">{line.label}</span>
          <span className="list-row-meta">{line.changeType}</span>
        </li>
      ))}
    </ul>
  )
}
