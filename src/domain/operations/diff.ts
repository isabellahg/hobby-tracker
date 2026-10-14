import type { ChangedRecord } from './envelope'

export interface ChangeLine {
  store: string
  id: string
  changeType: ChangedRecord['changeType']
  label: string
}

const SINGULAR_BY_STORE: Record<string, string> = {
  hobbies: 'hobby',
  skills: 'skill',
  taskDefs: 'task',
  routines: 'routine',
  weeklyPlan: 'weekly plan',
  sessions: 'session',
  projects: 'project',
  personalRecords: 'milestone',
  planBuckets: 'plan bucket',
}

function pickLabel(record: unknown): string {
  if (record && typeof record === 'object') {
    const anyRecord = record as Record<string, unknown>
    if (typeof anyRecord.name === 'string') return anyRecord.name
    if (typeof anyRecord.label === 'string') return anyRecord.label
    if (typeof anyRecord.description === 'string') return anyRecord.description
  }
  return ''
}

/** Turns raw ChangedRecord entries into short human-readable lines for the preview UI. */
export function describeChanges(changes: ChangedRecord[]): ChangeLine[] {
  return changes.map((c) => {
    const label = pickLabel(c.after ?? c.before)
    const verb = c.changeType === 'created' ? 'Create' : c.changeType === 'deleted' ? 'Delete' : 'Update'
    const noun = SINGULAR_BY_STORE[c.store] ?? c.store.replace(/s$/, '')
    return {
      store: c.store,
      id: c.id,
      changeType: c.changeType,
      label: `${verb} ${noun}${label ? `: "${label}"` : ` #${c.id.slice(0, 8)}`}`,
    }
  })
}
