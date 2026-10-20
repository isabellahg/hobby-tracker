import { describe, expect, it } from 'vitest'
import type { TaskDef } from '../types/taskDef'
import { habitProgress, normalizeFrequency } from './habits'
import { makeSession } from './testHelpers'

const habit: TaskDef = {
  id: 'h', label: 'Sketch', hobbyIds: [], skillIds: [], kind: 'recurring', archived: false,
  status: 'ongoing', habit: { period: 'week', min: 1, avg: 2, amazing: 3 },
  createdAt: '', updatedAt: '',
}
const done = (dateKey: string) =>
  makeSession(dateKey, 'finished', {
    taskEntries: [
      { id: 'e', taskDefId: 'h', label: 'Sketch', hobbyIds: [], skillIds: [], status: 'completed', order: 0, isAdHoc: false },
    ],
  })

describe('habitProgress', () => {
  // Thursday; the week started Monday 2026-10-26.
  const now = new Date('2026-10-29T12:00:00')

  it('counts finished sessions this week that completed the habit', () => {
    const p = habitProgress(habit, [done('2026-10-25'), done('2026-10-26'), done('2026-10-28')], now)
    expect(p.count).toBe(2)
    expect(p.rating).toBe('avg')
  })

  it('is below the minimum with nothing yet', () => {
    expect(habitProgress(habit, [], now).rating).toBe('below')
  })

  it('uses the calendar month for monthly habits', () => {
    const monthly = { ...habit, habit: { period: 'month' as const, min: 2, avg: 4, amazing: 8 } }
    expect(habitProgress(monthly, [done('2026-09-30'), done('2026-10-02'), done('2026-10-20')], now).count).toBe(2)
  })
})

describe('normalizeFrequency', () => {
  it('keeps min <= avg <= amazing', () => {
    expect(normalizeFrequency({ period: 'day', min: 3, avg: 1, amazing: 2 })).toEqual({
      period: 'day', min: 3, avg: 3, amazing: 3,
    })
  })
})
