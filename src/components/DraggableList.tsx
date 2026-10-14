import type { ReactNode } from 'react'

export interface DraggableItem {
  id: string
}

/**
 * A reorderable list with up/down controls. Deliberately not HTML5
 * drag-and-drop — up/down buttons are fully keyboard- and touch-accessible
 * and avoid drag-and-drop's long tail of browser quirks for a small
 * personal-data app like this one.
 */
export function DraggableList<T extends DraggableItem>({
  items,
  renderItem,
  onReorder,
}: {
  items: T[]
  renderItem: (item: T) => ReactNode
  onReorder: (orderedIds: string[]) => void
}) {
  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onReorder(next.map((i) => i.id))
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="stack">
      {items.map((item, index) => (
        <li key={item.id} className="row" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ flexDirection: 'column', gap: 2 }}>
            <button
              type="button"
              className="btn"
              style={{ padding: '0.1rem 0.4rem' }}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="btn"
              style={{ padding: '0.1rem 0.4rem' }}
              disabled={index === items.length - 1}
              onClick={() => move(index, 1)}
              aria-label="Move down"
            >
              ↓
            </button>
          </div>
          <div style={{ flex: 1 }}>{renderItem(item)}</div>
        </li>
      ))}
    </ul>
  )
}
