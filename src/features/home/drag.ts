import type { DragEvent } from 'react'

/** What a dragged backlog or planning-session card carries. */
export interface DragPayload {
  taskDefId: string
  /** null when dragged straight from the backlog, not out of a planning session. */
  sourceBucketId: string | null
}

const DRAG_MIME = 'application/x-plan-task'

export function startDrag(e: DragEvent, payload: DragPayload) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'move'
}

export function readDragPayload(e: DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DRAG_MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

export const allowDrop = (e: DragEvent) => e.preventDefault()
