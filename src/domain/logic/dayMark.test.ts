import { describe, expect, it } from 'vitest'
import { computeDayMarks, hasMarkOnDate } from './dayMark'
import { makeSession } from './testHelpers'

const RANGE = { start: '2026-10-05', end: '2026-10-11' }

describe('computeDayMarks', () => {
  it('marks a day with one qualifying session', () => {
    const marks = computeDayMarks([makeSession('2026-10-06')], RANGE)
    const day = marks.find((m) => m.date === '2026-10-06')
    expect(day?.hasMark).toBe(true)
    expect(day?.sessionIds).toHaveLength(1)
  })

  it('collapses multiple same-day qualifying sessions into one mark', () => {
    const sessions = [
      makeSession('2026-10-06'),
      makeSession('2026-10-06'),
      makeSession('2026-10-06'),
    ]
    const marks = computeDayMarks(sessions, RANGE)
    const day = marks.find((m) => m.date === '2026-10-06')
    expect(day?.hasMark).toBe(true)
    expect(day?.sessionIds).toHaveLength(3)
  })

  it('excludes discarded sessions', () => {
    const marks = computeDayMarks([makeSession('2026-10-06', 'discarded')], RANGE)
    const day = marks.find((m) => m.date === '2026-10-06')
    expect(day?.hasMark).toBe(false)
  })

  it('excludes still in-progress sessions', () => {
    const marks = computeDayMarks([makeSession('2026-10-06', 'in_progress')], RANGE)
    const day = marks.find((m) => m.date === '2026-10-06')
    expect(day?.hasMark).toBe(false)
  })

  it('a low-completion session still marks the day', () => {
    const session = makeSession('2026-10-06', 'finished', {
      taskEntries: [
        { id: 't1', label: 'a', hobbyIds: [], skillIds: [], status: 'pending', order: 0, isAdHoc: false },
        { id: 't2', label: 'b', hobbyIds: [], skillIds: [], status: 'completed', order: 1, isAdHoc: false },
      ],
    })
    const marks = computeDayMarks([session], RANGE)
    expect(marks.find((m) => m.date === '2026-10-06')?.hasMark).toBe(true)
  })

  it('leaves rest days unmarked', () => {
    const marks = computeDayMarks([makeSession('2026-10-06')], RANGE)
    const day = marks.find((m) => m.date === '2026-10-07')
    expect(day?.hasMark).toBe(false)
  })

  it('enumerates every date in the range even with no sessions', () => {
    const marks = computeDayMarks([], RANGE)
    expect(marks.map((m) => m.date)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ])
  })
})

describe('hasMarkOnDate', () => {
  it('reflects a single qualifying session', () => {
    expect(hasMarkOnDate([makeSession('2026-10-06')], '2026-10-06')).toBe(true)
    expect(hasMarkOnDate([makeSession('2026-10-06')], '2026-10-07')).toBe(false)
  })
})
