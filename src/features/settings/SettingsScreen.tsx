import { useState } from 'react'
import { db } from '../../storage/db'
import { useAppStore } from '../../state/store'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ListsSettings } from './ListsSettings'

export function SettingsScreen() {
  const load = useAppStore((s) => s.load)
  const [confirming, setConfirming] = useState(false)

  async function clearAll() {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
    await load()
    setConfirming(false)
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      <ListsSettings />

      <div className="card">
        <h3>About</h3>
        <p className="desc">
          Hobby Tracker — a local-only, LLM-friendly practice tracker. Phase 1 (web). All data lives in
          this browser's IndexedDB; nothing is sent anywhere.
        </p>
      </div>

      <div className="card">
        <h3>Danger zone</h3>
        <p className="desc">
          Permanently erase every hobby, skill, task, routine, session, and milestone. Export a backup
          first from the Data screen if you want to keep anything.
        </p>
        <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
          Clear all data
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Clear all data?"
          confirmLabel="Clear everything"
          danger
          onConfirm={clearAll}
          onCancel={() => setConfirming(false)}
        >
          <p>This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
