import { useState } from 'react'
import { EnterForm } from './EnterForm'

/**
 * Shows text that turns into an input when clicked. Enter or blur saves,
 * Escape cancels, and an empty value is rejected (the old text is kept).
 */
export function InlineEdit({
  value,
  onSave,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string
  onSave: (next: string) => void
  placeholder?: string
  ariaLabel: string
  className?: string
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
      <EnterForm onSubmit={commit} className="inline-edit-form">
        <input
          type="text"
          autoFocus
          enterKeyHint="done"
          aria-label={ariaLabel}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => editing && commit()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
          className={className}
        />
      </EnterForm>
    )
  }

  return (
    <button
      type="button"
      className={className ? `inline-edit ${className}` : 'inline-edit'}
      title="Click to edit"
      aria-label={`${ariaLabel}: ${value || placeholder || ''}`}
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
    >
      {value || <span className="muted">{placeholder}</span>}
      <span className="inline-edit-icon" aria-hidden="true">
        ✎
      </span>
    </button>
  )
}
