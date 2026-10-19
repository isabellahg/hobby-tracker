import { useState, type ClipboardEvent } from 'react'
import { needsLookup, takePaste, type Attachment } from '../lib/attachments'
import { fetchLinkMeta } from '../lib/linkMeta'
import { saveAttachment } from '../state/attachments'

/**
 * Pictures and links pasted into a "new task" form, held until the task
 * exists. A pasted link's title is offered through `onTitle` so an empty
 * name can be filled in with it.
 */
export function usePendingAttachments(onTitle?: (title: string) => void) {
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(0)

  function onPaste(e: ClipboardEvent) {
    const taken = takePaste(e)
    if (!taken) return
    setLoading((n) => n + 1)
    taken
      .then(async (list) => {
        setItems((prev) => [...prev, ...list])
        for (const a of list.filter(needsLookup)) {
          const meta = await fetchLinkMeta(a.src)
          setItems((prev) =>
            prev.map((x) => (x === a ? { ...x, title: meta.title, preview: meta.image } : x)),
          )
          if (meta.title) onTitle?.(meta.title)
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading((n) => n - 1))
  }

  /** A name for a task created from nothing but a pasted link. */
  function fallbackLabel(): string {
    const first = items[0]
    if (!first) return ''
    if (first.title) return first.title
    try {
      return new URL(first.src).hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  }

  /** Fire-and-forget: links still waiting on a lookup get their preview when it lands. */
  function saveTo(taskDefId: string) {
    const list = items
    setItems([])
    for (const a of list) saveAttachment(taskDefId, a).catch(() => undefined)
  }

  return {
    items,
    loading: loading > 0,
    onPaste,
    fallbackLabel,
    saveTo,
    remove: (index: number) => setItems((prev) => prev.filter((_, i) => i !== index)),
  }
}
