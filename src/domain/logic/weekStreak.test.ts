import { addDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { computeWeekStreak } from './weekStreak'
import { addWeeks, getWeekStart, toISODate } from './weekUtils'
import { makeSession } from './testHelpers'

// "now" sits mid-week (Wednesday) so the current week is genuinely in progress.
const NOW = new Date('2026-10-07T12:00:00.000Z')
const CURRENT_WEEK_START = getWeekStart(NOW)

/** `weeksAgo=0` is the current week; `dayOffset` 0=Mon .. 6=Sun. */
function dateKey(weeksAgo: number, dayOffset: number): string {
  return toISODate(addDays(addWeeks(CURRENT_WEEK_START, -weeksAgo), dayOffset))
}

describe('computeWeekStreak', () => {
  it('returns zeros for no history', () => {
    const result = computeWeekStreak([], NOW)
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      currentWeekStart: toISODate(CURRENT_WEEK_START),
      weekActiveDays: 0,
    })
  })

  it('an empty in-progress current week does not reset an existing streak', () => {
    const sessions = [
      makeSession(dateKey(1, 0)), // last week: qualifies
      makeSession(dateKey(2, 3)), // two weeks ago: qualifies
      // current week: no sessions yet
    ]
    const result = computeWeekStreak(sessions, NOW)
    expect(result.currentStreak).toBe(2)
    expect(result.weekActiveDays).toBe(0)
  })

  it('a session in the current week counts it toward the streak', () => {
    const sessions = [
      makeSession(dateKey(1, 0)),
      makeSession(dateKey(0, 2)), // today-ish, current week
    ]
    const result = computeWeekStreak(sessions, NOW)
    expect(result.currentStreak).toBe(2)
    expect(result.weekActiveDays).toBe(1)
  })

  it('a fully empty completed week breaks the streak', () => {
    const sessions = [
      makeSession(dateKey(3, 0)), // qualifies
      // week -2: empty (break)
      makeSession(dateKey(1, 0)), // qualifies
      makeSession(dateKey(0, 1)), // current week qualifies
    ]
    const result = computeWeekStreak(sessions, NOW)
    // streak only counts back through the unbroken run ending at "now"
    expect(result.currentStreak).toBe(2)
  })

  it('multiple sessions in the same week still count once toward activeDays per day but one qualifying week', () => {
    const sessions = [
      makeSession(dateKey(0, 0)),
      makeSession(dateKey(0, 0)),
      makeSession(dateKey(0, 2)),
    ]
    const result = computeWeekStreak(sessions, NOW)
    expect(result.currentStreak).toBe(1)
    expect(result.weekActiveDays).toBe(2)
  })

  it('longest streak survives a later break and is not reset by it', () => {
    const sessions = [
      makeSession(dateKey(5, 0)),
      makeSession(dateKey(4, 0)),
      makeSession(dateKey(3, 0)),
      makeSession(dateKey(2, 0)),
      // week -1: empty, break
      makeSession(dateKey(0, 0)), // current week qualifies, streak restarts at 1
    ]
    const result = computeWeekStreak(sessions, NOW)
    expect(result.currentStreak).toBe(1)
    expect(result.longestStreak).toBe(4)
  })

  it('the current streak can itself become the new longest', () => {
    const sessions = [
      makeSession(dateKey(2, 0)),
      makeSession(dateKey(1, 0)),
      makeSession(dateKey(0, 0)),
    ]
    const result = computeWeekStreak(sessions, NOW)
    expect(result.currentStreak).toBe(3)
    expect(result.longestStreak).toBe(3)
  })

  it('a discarded session never qualifies a week', () => {
    const sessions = [makeSession(dateKey(0, 0), 'discarded')]
    const result = computeWeekStreak(sessions, NOW)
    expect(result.currentStreak).toBe(0)
    expect(result.weekActiveDays).toBe(0)
  })

  it('first-ever week with a single qualifying session', () => {
    const sessions = [makeSession(dateKey(0, 4))]
    const result = computeWeekStreak(sessions, NOW)
    expect(result.currentStreak).toBe(1)
    expect(result.longestStreak).toBe(1)
  })
})
