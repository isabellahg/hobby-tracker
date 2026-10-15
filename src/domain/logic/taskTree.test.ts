import { describe, expect, it } from 'vitest'
import type { TaskDef } from '../types/taskDef'
import { childProgress, childrenOf, descendantsOf, wouldCreateCycle } from './taskTree'
import { toggleTask } from './sessionLifecycle'
import { makeSession } from './testHelpers'
import type { SessionTaskEntry } from '../types/session'

function task(id: string, parentId?: string, extra: Partial<TaskDef> = {}): TaskDef {
  return {
    id,
    label: id,
    hobbyIds: [],
    skillIds: [],
    kind: 'once',
    parentId,
    archived: false,
    createdAt: `2026-10-15T09:00:0${id.length}.000Z`,
    updatedAt: '',
    ...extra,
  }
}

const tree = [task('ccc', 'a'), task('a'), task('bb', 'a'), task('dddd', 'bb'), task('x')]

describe('taskTree', () => {
  it('lists children oldest first and descendants depth-first', () => {
    expect(childrenOf(tree, 'a').map((t) => t.id)).toEqual(['bb', 'ccc'])
    expect(descendantsOf(tree, 'a').map((t) => t.id)).toEqual(['bb', 'dddd', 'ccc'])
    expect(descendantsOf(tree, 'x')).toEqual([])
  })

  it('detects cycles', () => {
    expect(wouldCreateCycle(tree, 'a', 'a')).toBe(true)
    expect(wouldCreateCycle(tree, 'a', 'dddd')).toBe(true)
    expect(wouldCreateCycle(tree, 'bb', 'x')).toBe(false)
  })

  it('counts closed children and ignores recurring ones', () => {
    const tasks = [
      task('p'),
      task('c1', 'p', { archived: true }),
      task('c2', 'p'),
      task('c3', 'p', { kind: 'recurring' }),
    ]
    expect(childProgress(tasks, 'p')).toEqual({ done: 1, total: 2 })
  })
})

describe('toggleTask with subtasks', () => {
  const entry = (id: string, parentEntryId?: string, status: SessionTaskEntry['status'] = 'pending'): SessionTaskEntry => ({
    id,
    label: id,
    hobbyIds: [],
    skillIds: [],
    status,
    order: 0,
    isAdHoc: false,
    parentEntryId,
  })

  it('completes the parent (and grandparent) once every non-skipped child is done', () => {
    const session = makeSession('2026-10-15', 'in_progress', {
      taskEntries: [entry('g'), entry('p', 'g'), entry('c1', 'p'), entry('c2', 'p', 'skipped')],
    })
    const after = toggleTask(session, 'c1')
    expect(after.taskEntries.map((e) => e.status)).toEqual(['completed', 'completed', 'completed', 'skipped'])
  })

  it('unchecking a child reopens its completed parent', () => {
    const session = makeSession('2026-10-15', 'in_progress', {
      taskEntries: [entry('p', undefined, 'completed'), entry('c1', 'p', 'completed'), entry('c2', 'p')],
    })
    const after = toggleTask(session, 'c1')
    expect(after.taskEntries.map((e) => e.status)).toEqual(['pending', 'pending', 'pending'])
  })

  it('leaves the parent alone while siblings are still pending', () => {
    const session = makeSession('2026-10-15', 'in_progress', {
      taskEntries: [entry('p'), entry('c1', 'p'), entry('c2', 'p')],
    })
    expect(toggleTask(session, 'c1').taskEntries[0].status).toBe('pending')
  })
})
