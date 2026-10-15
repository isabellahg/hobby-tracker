import { useState, type HTMLAttributes, type ReactNode } from 'react'

/**
 * A bordered, collapsible section: caret · icon · title · count, with optional
 * right-aligned actions and an italic one-line description. Extra props
 * (e.g. drag-and-drop handlers) go on the outer element.
 */
export function Panel({
  title,
  icon,
  count,
  description,
  actions,
  defaultOpen = true,
  className,
  children,
  ...rest
}: {
  /** A string title is part of the collapse button; a node (e.g. InlineEdit) sits beside it. */
  title: ReactNode
  icon?: ReactNode
  count?: number
  description?: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  children?: ReactNode
} & Omit<HTMLAttributes<HTMLElement>, 'title'>) {
  const [open, setOpen] = useState(defaultOpen)
  const titleIsText = typeof title === 'string'

  return (
    <section className={className ? `panel ${className}` : 'panel'} {...rest}>
      <div className="panel-header">
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={open}
          aria-label={titleIsText ? undefined : open ? 'Collapse' : 'Expand'}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="panel-caret" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          {icon && (
            <span className="panel-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          {titleIsText && title}
        </button>
        {!titleIsText && title}
        {count !== undefined && <span className="panel-count">({count})</span>}
        {actions && <div className="panel-actions">{actions}</div>}
      </div>
      {open && (
        <div className="panel-body">
          {description && <p className="desc">{description}</p>}
          {children}
        </div>
      )}
    </section>
  )
}
