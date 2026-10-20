import { startOfMonth } from 'date-fns'
import type { Session } from '../types/session'
import type { HabitFrequency, HabitPeriod, TaskDef } from '../types/taskDef'
import { isQualifyingSession } from './qualifyingSession'
import { getWeekStart, toISODate } from './weekUtils'

export const DEFAULT_HABIT: HabitFrequency = { period: 'week', min: 1, avg: 2, amazing: 3 }

export const PERIOD_LABEL: Record<HabitPeriod, string> = { day: 'day', week: 'week', month: 'month' }

/** 'below' = under the minimum so far this period. */
export type HabitRating = 'below' | 'min' | 'avg' | 'amazing'

export const RATING_LABEL: Record<HabitRating, string> = {
  below: 'below min',
  min: 'minimum',
  avg: 'on track',
  amazing: 'amazing',
}

/** First calendar date of the period containing `now`. */
export function periodStart(period: HabitPeriod, now: Date): string {
  if (period === 'day') return toISODate(now)
  if (period === 'week') return toISODate(getWeekStart(now))
  return toISODate(startOfMonth(now))
}

export function rate(count: number, freq: HabitFrequency): HabitRating {
  if (count >= freq.amazing) return 'amazing'
  if (count >= freq.avg) return 'avg'
  if (count >= freq.min) return 'min'
  return 'below'
}

export interface HabitProgress {
  freq: HabitFrequency
  /** Finished sessions this period that included the habit. */
  count: number
  rating: HabitRating
}

export function habitProgress(task: TaskDef, sessions: Session[], now: Date): HabitProgress {
  const freq = task.habit ?? DEFAULT_HABIT
  const from = periodStart(freq.period, now)
  const today = toISODate(now)
  const count = sessions.filter(
    (s) =>
      isQualifyingSession(s) &&
      s.dateKey >= from &&
      s.dateKey <= today &&
      s.taskEntries.some((e) => e.taskDefId === task.id && e.status === 'completed'),
  ).length
  return { freq, count, rating: rate(count, freq) }
}

/** Keeps min ≤ avg ≤ amazing (and all ≥ 1) whatever was typed. */
export function normalizeFrequency(freq: HabitFrequency): HabitFrequency {
  const min = Math.max(1, Math.round(freq.min))
  const avg = Math.max(min, Math.round(freq.avg))
  const amazing = Math.max(avg, Math.round(freq.amazing))
  return { period: freq.period, min, avg, amazing }
}
