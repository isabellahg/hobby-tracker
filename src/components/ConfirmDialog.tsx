import type { ReactNode } from 'react'

export function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string
  children?: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div role="dialog" aria-modal="true" className="dialog-backdrop" onClick={onCancel}>
      <div className="card stack dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="m0">{title}</h3>
        {children}
        <div className="row row-end">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
