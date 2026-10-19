import { describe, expect, it } from 'vitest'
import { activityByDate, intensityLevel, monthWeeks, periodTotals, timeByTag, yearWeeks } from './activity'
import { makeSession } from './testHelpers'

describe('activityByDate', () => {
  it('adds up finished sessions per day and skips discarded or running ones', () => {
    const byDate = activityByDate([
      makeSession('2026-10-19', 'finished', { durationSec: 1200 }),
      makeSession('2026-10-19', 'finished', { durationSec: 600 }),
      makeSession('2026-10-19', 'discarded', { durationSec: 9999 }),
      makeSession('2026-10-18', 'in_progress'),
    ])
    expect(byDate.get('2026-10-19')).toMatchObject({ sec: 1800 })
    expect(byDate.get('2026-10-19')!.sessionIds).toHaveLength(2)
    expect(byDate.has('2026-10-18')).toBe(false)
  })

  it('can be narrowed to one hobby or skill', () => {
    const sessions = [
      makeSession('2026-10-01', 'finished', { hobbyIds: ['art'], durationSec: 60 }),
      makeSession('2026-10-02', 'finished', { hobbyIds: ['gamedev'], durationSec: 60 }),
    ]
    expect([...activityByDate(sessions, { hobbyId: 'art' }).keys()]).toEqual(['2026-10-01'])
  })
})

describe('intensityLevel', () => {
  it('uses fixed time thresholds', () => {
    const day = (min: number) => ({ sec: min * 60, sessionIds: ['x'] })
    expect(intensityLevel(undefined)).toBe(0)
    expect(intensityLevel(day(0))).toBe(1) // a session with no time still counts
    expect(intensityLevel(day(45))).toBe(2)
    expect(intensityLevel(day(90))).toBe(3)
    expect(intensityLevel(day(240))).toBe(4)
  })
})

describe('calendar grids', () => {
  it('lays October 2026 out Monday-first', () => {
    const weeks = monthWeeks(new Date(2026, 9, 1))
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(weeks.at(-1)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null])
    expect(weeks.flat().filter(Boolean)).toHaveLength(31)
  })

  it('covers every day of the year exactly once', () => {
    const days = yearWeeks(2026).flat().filter(Boolean)
    expect(days).toHaveLength(365)
    expect(days[0]).toBe('2026-01-01')
    expect(days.at(-1)).toBe('2026-12-31')
  })
})

describe('periodTotals', () => {
  const byDate = activityByDate([
    makeSession('2026-10-19', 'finished', { durationSec: 3600 }),
    makeSession('2026-10-18', 'finished', { durationSec: 1800 }),
    makeSession('2026-09-02', 'finished', { durationSec: 600 }),
  ])

  it('totals the last N weeks, ending with this one', () => {
    const weeks = periodTotals(byDate, 'week', 2, new Date(2026, 9, 21))
    expect(weeks.map((w) => [w.start, w.sec, w.activeDays])).toEqual([
      ['2026-10-12', 1800, 1],
      ['2026-10-19', 3600, 1],
    ])
  })

  it('totals the last N months', () => {
    const months = periodTotals(byDate, 'month', 3, new Date(2026, 9, 21))
    expect(months.map((m) => [m.label, m.sec, m.sessions])).toEqual([
      ['Aug', 0, 0],
      ['Sep', 600, 1],
      ['Oct', 5400, 2],
    ])
  })
})

describe('timeByTag', () => {
  it('credits a session to each of its tags', () => {
    const totals = timeByTag(
      [makeSession('2026-10-01', 'finished', { skillIds: ['a', 'b'], durationSec: 600 })],
      (s) => s.skillIds,
    )
    expect(totals).toEqual({ a: { sec: 600, sessions: 1 }, b: { sec: 600, sessions: 1 } })
  })
})
