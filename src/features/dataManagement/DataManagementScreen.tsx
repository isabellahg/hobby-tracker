import { useRef, useState } from 'react'
import { useAppStore } from '../../state/store'
import {
  applyImport,
  computeImportDiff,
  downloadExport,
  exportAllData,
  type ExportedData,
  type ImportMode,
  type TableDiff,
} from '../../storage/exportImport'
import { ConfirmDialog } from '../../components/ConfirmDialog'

export function DataManagementScreen() {
  const load = useAppStore((s) => s.load)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<ExportedData | null>(null)
  const [diffs, setDiffs] = useState<TableDiff[] | null>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function handleExport() {
    const exported = await exportAllData()
    downloadExport(exported)
    setStatus('Export downloaded.')
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as ExportedData
      if (parsed.version !== 1 || typeof parsed.data !== 'object') {
        throw new Error('This file is not a recognized Hobby Tracker export.')
      }
      const computedDiffs = await computeImportDiff(parsed)
      setPendingImport(parsed)
      setDiffs(computedDiffs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this file.')
    }
  }

  async function confirmImport() {
    if (!pendingImport) return
    await applyImport(pendingImport, mode)
    setPendingImport(null)
    setDiffs(null)
    await load()
    setStatus('Import applied.')
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Data</h2>
      </div>

      <div className="card stack">
        <h3 className="m0">Export</h3>
        <p className="desc m0">Download your entire dataset as a JSON file.</p>
        <div>
          <button type="button" className="btn btn-primary" onClick={handleExport}>
            Export to file
          </button>
        </div>
      </div>

      <div className="card stack">
        <h3 className="m0">Import from file</h3>
        <p className="desc m0">
          Nothing is overwritten or duplicated silently — you'll see exactly what would change before
          anything is applied.
        </p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChosen}
          />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {status && <p className="muted">{status}</p>}

      <div className="card">
        <h3 className="m0">LLM Import</h3>
        <p className="desc m0">Paste operation JSON from an LLM under the "LLM Import" tab.</p>
      </div>

      {pendingImport && diffs && (
        <ConfirmDialog
          title="Review import"
          confirmLabel={mode === 'replace' ? 'Replace all data' : 'Merge'}
          danger={mode === 'replace'}
          onConfirm={confirmImport}
          onCancel={() => {
            setPendingImport(null)
            setDiffs(null)
          }}
        >
          <div className="stack">
            <div className="row">
              <label className="inline">
                <input
                  type="radio"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                />{' '}
                Merge (add new, update changed, never touch anything else)
              </label>
            </div>
            <div className="row">
              <label className="inline">
                <input
                  type="radio"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                />{' '}
                Replace everything with this file
              </label>
            </div>
            <table className="kv-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>New</th>
                  <th>Changed</th>
                  <th>Unchanged</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <tr key={d.table}>
                    <td>{d.table}</td>
                    <td>{d.toCreate}</td>
                    <td>{d.toUpdate}</td>
                    <td>{d.unchanged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
}
