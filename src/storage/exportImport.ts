import { ALL_TABLE_NAMES, db, type TableName } from './db'
import { metaRepo } from './repositories/metaRepo'

export interface ExportedData {
  version: 1
  exportedAt: string
  /** Older backups predate some tables; a missing one imports as empty. */
  data: Partial<Record<TableName, unknown[]>>
}

export async function exportAllData(): Promise<ExportedData> {
  const data = {} as Record<TableName, unknown[]>
  for (const name of ALL_TABLE_NAMES) {
    data[name] = await db.table(name).toArray()
  }
  return { version: 1, exportedAt: new Date().toISOString(), data }
}

export function downloadExport(exported: ExportedData): void {
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hobby-tracker-backup-${exported.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export interface TableDiff {
  table: TableName
  toCreate: number
  toUpdate: number
  unchanged: number
}

function byId(rows: unknown[]): Map<string, unknown> {
  const map = new Map<string, unknown>()
  for (const row of rows) {
    const id = (row as { id?: string })?.id
    if (typeof id === 'string') map.set(id, row)
  }
  return map
}

export async function computeImportDiff(incoming: ExportedData): Promise<TableDiff[]> {
  const diffs: TableDiff[] = []
  for (const name of ALL_TABLE_NAMES) {
    const incomingRows = incoming.data[name] ?? []
    const existingRows = await db.table(name).toArray()
    const existingById = byId(existingRows)
    let toCreate = 0
    let toUpdate = 0
    let unchanged = 0
    for (const row of incomingRows) {
      const id = (row as { id?: string })?.id
      if (!id || !existingById.has(id)) {
        toCreate++
      } else if (JSON.stringify(existingById.get(id)) === JSON.stringify(row)) {
        unchanged++
      } else {
        toUpdate++
      }
    }
    diffs.push({ table: name, toCreate, toUpdate, unchanged })
  }
  return diffs
}

export type ImportMode = 'merge' | 'replace'

/**
 * `changedAt` stamps this device's data as changed at that moment (default:
 * now). Sync passes the sending device's stamp so both sides then agree.
 */
export async function applyImport(
  incoming: ExportedData,
  mode: ImportMode,
  changedAt: string = new Date().toISOString(),
): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of ALL_TABLE_NAMES) {
      const incomingRows = incoming.data[name] ?? []
      const table = db.table(name)
      if (mode === 'replace') {
        await table.clear()
      }
      if (incomingRows.length > 0) await table.bulkPut(incomingRows)
    }
    await metaRepo.setLastChangedAt(changedAt)
  })
}
