import { db } from '../db'

const APPLIED_REQUEST_IDS_KEY = 'appliedRequestIds'
/** When this device's data last changed — sync uses it to pick the newer side. */
const LAST_CHANGED_AT_KEY = 'lastChangedAt'

export const metaRepo = {
  async wasRequestApplied(requestId: string): Promise<boolean> {
    const row = await db.meta.get(APPLIED_REQUEST_IDS_KEY)
    const ids = (row?.value as string[] | undefined) ?? []
    return ids.includes(requestId)
  },
  async markRequestApplied(requestId: string): Promise<void> {
    const row = await db.meta.get(APPLIED_REQUEST_IDS_KEY)
    const ids = new Set((row?.value as string[] | undefined) ?? [])
    ids.add(requestId)
    // Cap retained history so this doesn't grow unbounded over the app's lifetime.
    const trimmed = [...ids].slice(-2000)
    await db.meta.put({ key: APPLIED_REQUEST_IDS_KEY, value: trimmed })
  },
  async getLastChangedAt(): Promise<string | null> {
    const row = await db.meta.get(LAST_CHANGED_AT_KEY)
    return (row?.value as string | undefined) ?? null
  },
  async setLastChangedAt(at: string): Promise<void> {
    await db.meta.put({ key: LAST_CHANGED_AT_KEY, value: at })
  },
}
