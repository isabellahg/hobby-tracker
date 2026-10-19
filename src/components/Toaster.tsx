import { Link } from 'react-router-dom'
import { useToasts } from '../state/toast'

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={t.tone === 'error' ? 'toast toast-error' : 'toast'}>
          <span className="grow">{t.message}</span>
          {t.link && (
            <Link to={t.link.to} className="toast-link" onClick={() => dismiss(t.id)}>
              {t.link.label}
            </Link>
          )}
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
