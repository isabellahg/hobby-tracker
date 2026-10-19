import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '../../state/store'
import { sessionTitle } from '../session/sessionTitle'
import { loggableSessions, logCompleted, sessionWhen } from './logCompleted'

export interface MenuAnchor {
  taskDefId: string
  x: number
  y: number
}

const MENU_WIDTH = 250

/**
 * Right-click (or long-press) menu for a task card:
 * "Completed on ›" lists sessions to log it in — for when you did it but
 * never added it.
 */
export function TaskContextMenu({
  anchor,
  onClose,
  onEdit,
}: {
  anchor: MenuAnchor
  onClose: () => void
  onEdit?: (taskDefId: string) => void
}) {
  const sessions = useAppStore((s) => s.sessions)
  const routines = useAppStore((s) => s.routines)
  const [subOpen, setSubOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const targets = loggableSessions(sessions)
  // No room for a flyout to the right: open the session list underneath instead.
  const subInline = anchor.x + MENU_WIDTH * 2 + 16 > window.innerWidth

  // Keep the whole menu on screen.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.left = `${Math.max(8, Math.min(anchor.x, window.innerWidth - rect.width - 8))}px`
    el.style.top = `${Math.max(8, Math.min(anchor.y, window.innerHeight - rect.height - 8))}px`
  }, [anchor, subOpen])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return (
    <div ref={ref} className="ctx-menu" role="menu" style={{ left: anchor.x, top: anchor.y, width: MENU_WIDTH }}>
      <div className="ctx-wrap">
        <button
          type="button"
          role="menuitem"
          className="ctx-item"
          aria-haspopup="menu"
          aria-expanded={subOpen}
          onClick={() => setSubOpen((o) => !o)}
          onMouseEnter={() => setSubOpen(true)}
          autoFocus
        >
          <span className="grow">✓ Completed on</span>
          <span aria-hidden="true">{subInline ? (subOpen ? '▾' : '▸') : '›'}</span>
        </button>
        {subOpen && (
          <div className={subInline ? 'ctx-sub ctx-sub-inline' : 'ctx-sub'} role="menu" style={{ width: MENU_WIDTH }}>
            {targets.length === 0 && <div className="ctx-empty">No sessions yet</div>}
            {targets.map((s) => (
              <button
                key={s.id}
                type="button"
                role="menuitem"
                className="ctx-item"
                onClick={() => {
                  logCompleted(anchor.taskDefId, s)
                  onClose()
                }}
              >
                <span className="grow ctx-label">{sessionTitle(s, routines)}</span>
                <span className="ctx-meta">{sessionWhen(s)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {onEdit && (
        <button
          type="button"
          role="menuitem"
          className="ctx-item"
          onMouseEnter={() => !subInline && setSubOpen(false)}
          onClick={() => {
            onEdit(anchor.taskDefId)
            onClose()
          }}
        >
          ✎ Edit
        </button>
      )}
    </div>
  )
}
