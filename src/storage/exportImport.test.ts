import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { applyImport, computeImportDiff, exportAllData, type ExportedData } from './exportImport'
import type { Hobby } from '../domain/types/hobby'

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
})

function makeHobby(id: string, name: string): Hobby {
  const now = new Date().toISOString()
  return { id, name, archived: false, createdAt: now, updatedAt: now }
}

describe('exportAllData', () => {
  it('captures every table', async () => {
    await db.hobbies.put(makeHobby('h1', 'Art'))
    const exported = await exportAllData()
    expect(exported.version).toBe(1)
    expect(exported.data.hobbies).toHaveLength(1)
    expect(exported.data.sessions).toEqual([])
  })
})

describe('computeImportDiff', () => {
  it('classifies rows as new, changed, or unchanged', async () => {
    const h1 = makeHobby('h1', 'Art')
    await db.hobbies.put(h1)
    await db.hobbies.put(makeHobby('h2', 'Music'))

    const incoming: ExportedData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        hobbies: [h1, makeHobby('h2', 'Music (renamed)'), makeHobby('h3', 'New one')],
        skills: [],
        taskDefs: [],
        routines: [],
        weeklyPlan: [],
        sessions: [],
        personalRecords: [],
        planBuckets: [],
        taskMedia: [],
      },
    }

    const diffs = await computeImportDiff(incoming)
    const hobbyDiff = diffs.find((d) => d.table === 'hobbies')!
    expect(hobbyDiff.unchanged).toBe(1) // h1
    expect(hobbyDiff.toUpdate).toBe(1) // h2 renamed
    expect(hobbyDiff.toCreate).toBe(1) // h3
  })
})

describe('applyImport', () => {
  const incoming: ExportedData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      hobbies: [makeHobby('h1', 'Imported hobby')],
      skills: [],
      taskDefs: [],
      routines: [],
      weeklyPlan: [],
      sessions: [],
      personalRecords: [],
      planBuckets: [],
      taskMedia: [],
    },
  }

  it('merge adds/updates without touching untouched existing records', async () => {
    await db.hobbies.put(makeHobby('existing', 'Keep me'))
    await applyImport(incoming, 'merge')
    const all = await db.hobbies.toArray()
    expect(all.map((h) => h.id).sort()).toEqual(['existing', 'h1'])
  })

  it('replace wipes existing records first', async () => {
    await db.hobbies.put(makeHobby('existing', 'Will be gone'))
    await applyImport(incoming, 'replace')
    const all = await db.hobbies.toArray()
    expect(all.map((h) => h.id)).toEqual(['h1'])
  })

  it('round-trips export -> clear -> import back to the same state', async () => {
    await db.hobbies.put(makeHobby('h1', 'Art'))
    const exported = await exportAllData()

    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
    expect(await db.hobbies.count()).toBe(0)

    await applyImport(exported, 'replace')
    const restored = await db.hobbies.toArray()
    expect(restored).toHaveLength(1)
    expect(restored[0].name).toBe('Art')
  })
})
