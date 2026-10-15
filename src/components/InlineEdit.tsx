import { useState, type CSSProperties } from 'react'

/**
 * Shows text that turns into an input when clicked. Enter or blur saves,
 * Escape cancels, and an empty value is rejected (the old text is kept).
 */
export function InlineEdit({
  value,
  onSave,
  placeholder,
  ariaLabel,
  style,
}: {
  value: string
  onSave: (next: string) => void
  placeholder?: string
  ariaLabel: string
  style?: CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    setEditing(false)
    const next = draft.trim()
    if (next && next !== value) onSave(next)
    else setDraft(value)
  }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        style={style}
      />
    )
  }

  return (
    <button
      type="button"
      className="inline-edit"
      title="Click to edit"
      aria-label={`${ariaLabel}: ${value || placeholder || ''}`}
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      style={style}
    >
      {value || <span className="muted">{placeholder}</span>}
      <span className="inline-edit-icon" aria-hidden="true">
        ✎
      </span>
    </button>
  )
}
