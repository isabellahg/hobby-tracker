import { describe, expect, it } from 'vitest'
import { countSessionsForTask } from './taskProgress'
import { makeSession } from './testHelpers'

const entry = (taskDefId: string) => ({
  id: `e-${taskDefId}-${Math.random()}`,
  taskDefId,
  label: taskDefId,
  hobbyIds: [],
  skillIds: [],
  status: 'pending' as const,
  order: 0,
  isAdHoc: false,
})

describe('countSessionsForTask', () => {
  it('counts only finished sessions that included the task', () => {
    const sessions = [
      makeSession('2026-10-01', 'finished', { taskEntries: [entry('course')] }),
      makeSession('2026-10-02', 'finished', { taskEntries: [entry('course'), entry('other')] }),
      makeSession('2026-10-03', 'discarded', { taskEntries: [entry('course')] }),
      makeSession('2026-10-04', 'in_progress', { taskEntries: [entry('course')] }),
      makeSession('2026-10-05', 'finished', { taskEntries: [entry('other')] }),
    ]
    expect(countSessionsForTask(sessions, 'course')).toBe(2)
  })
})
