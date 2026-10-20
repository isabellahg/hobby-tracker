import { describe, expect, it } from 'vitest'
import type { ItemList } from '../types/list'
import type { TaskDef } from '../types/taskDef'
import { partitionBacklog, staleWeeks } from './listItems'

function task(id: string, extra: Partial<TaskDef> = {}): TaskDef {
  return {
    id, label: id, hobbyIds: [], skillIds: [], kind: 'once', archived: false,
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...extra,
  }
}
function list(id: string, order: number, archived = false): ItemList {
  return { id, name: id, order, archived, createdAt: '', updatedAt: '' }
}

describe('partitionBacklog', () => {
  const lists = [list('watch', 1), list('read', 0), list('old', 2, true)]

  it('lifts active habits and ongoing list items out of the plain backlog', () => {
    const p = partitionBacklog(
      [
        task('plain'),
        task('habit', { kind: 'recurring', status: 'ongoing' }),
        task('paused-habit', { kind: 'recurring', status: 'paused' }),
        task('book', { listId: 'read', status: 'ongoing' }),
        task('film', { listId: 'watch', status: 'ongoing' }),
        task('someday', { listId: 'watch', status: 'want' }),
        task('pinned', { listId: 'watch', status: 'want', inBacklog: true }),
        task('hidden', { listId: 'old', status: 'ongoing', inBacklog: true }),
      ],
      lists,
    )
    expect(p.habits.map((t) => t.id)).toEqual(['habit'])
    expect(p.ongoing.map((g) => [g.list.id, g.tasks.map((t) => t.id)])).toEqual([
      ['read', ['book']],
      ['watch', ['film']],
    ])
    expect(p.main.map((t) => t.id)).toEqual(['plain', 'pinned'])
  })
})

describe('staleWeeks', () => {
  const now = new Date('2026-10-30T12:00:00')

  it('nudges an ongoing item untouched for three weeks', () => {
    const t = task('book', { listId: 'read', status: 'ongoing', statusAt: '2026-10-01T00:00:00.000Z' })
    expect(staleWeeks(t, undefined, now)).toBe(4)
  })

  it('stays quiet when a recent session touched it', () => {
    const t = task('book', { listId: 'read', status: 'ongoing', statusAt: '2026-09-01T00:00:00.000Z' })
    expect(staleWeeks(t, { sessions: 1, lastDate: '2026-10-25' }, now)).toBeNull()
  })

  it('ignores items that are not ongoing', () => {
    const t = task('book', { listId: 'read', status: 'paused', statusAt: '2026-01-01T00:00:00.000Z' })
    expect(staleWeeks(t, undefined, now)).toBeNull()
  })
})
