import { run } from './actions'
import { needsLookup, type Attachment } from '../lib/attachments'
import { fetchLinkMeta } from '../lib/linkMeta'

/**
 * Attaches right away, then fills in the link's title and picture when the
 * lookup comes back — so a slow or offline lookup never holds anything up.
 */
export async function saveAttachment(taskDefId: string, a: Attachment): Promise<void> {
  const result = await run({ operation: 'taskDef.addMedia', payload: { taskDefId, ...a } })
  if (!result.success) throw new Error(result.errors?.[0]?.message ?? 'Could not attach that')
  if (!needsLookup(a)) return
  const meta = await fetchLinkMeta(a.src)
  if (!meta.title && !meta.image) return
  await run({
    operation: 'taskDef.updateMedia',
    payload: { id: result.changes[0].id, title: meta.title, preview: meta.image },
  })
}
