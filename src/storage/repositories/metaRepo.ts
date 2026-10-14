import { db } from '../db'

const APPLIED_REQUEST_IDS_KEY = 'appliedRequestIds'

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
}
