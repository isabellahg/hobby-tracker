import { describe, expect, it } from 'vitest'
import type { TaskDef } from '../types/taskDef'
import { groupBacklog, sortBacklog, taskActivity } from './backlogView'
import { makeSession } from './testHelpers'

function task(id: string, createdAt: string, extra: Partial<TaskDef> = {}): TaskDef {
  return {
    id,
    label: id,
    kind: 'once',
    hobbyIds: [],
    skillIds: [],
    archived: false,
    createdAt,
    ...extra,
  } as TaskDef
}

const entry = (taskDefId: string) => ({
  id: `e-${taskDefId}`,
  taskDefId,
  label: taskDefId,
  status: 'completed' as const,
  isAdHoc: false,
  hobbyIds: [],
  skillIds: [],
  order: 0,
})

describe('taskActivity', () => {
  it('counts finished sessions, including ones that only touched a subtask', () => {
    const parent = task('parent', '2026-01-01')
    const child = task('child', '2026-01-02', { parentId: 'parent' })
    const sessions = [
      makeSession('2026-10-01', 'finished', { taskEntries: [entry('parent')] }),
      makeSession('2026-10-05', 'finished', { taskEntries: [entry('child')] }),
      makeSession('2026-10-06', 'discarded', { taskEntries: [entry('parent')] }),
    ]
    expect(taskActivity(sessions, [parent, child], [parent]).get('parent')).toEqual({ sessions: 2, lastDate: '2026-10-05' })
  })
})

describe('sortBacklog', () => {
  const a = task('a', '2026-01-01')
  const b = task('b', '2026-02-01')
  const c = task('c', '2026-03-01')
  const activity = new Map([
    ['a', { sessions: 3, lastDate: '2026-09-01' }],
    ['b', { sessions: 3, lastDate: '2026-10-01' }],
    ['c', { sessions: 0 }],
  ])
  const ids = (list: TaskDef[]) => list.map((t) => t.id)

  it('newest first', () => expect(ids(sortBacklog([a, b, c], activity, 'added'))).toEqual(['c', 'b', 'a']))
  it('most active first, recent breaking ties', () => expect(ids(sortBacklog([a, b, c], activity, 'active'))).toEqual(['b', 'a', 'c']))
  it('neglected first', () => expect(ids(sortBacklog([a, b, c], activity, 'quiet'))).toEqual(['c', 'a', 'b']))
})

describe('groupBacklog', () => {
  const tags = [
    { id: 's2', name: 'Lights' },
    { id: 's1', name: 'Anatomy' },
  ]
  it('puts a task under each of its skills and the untagged last', () => {
    const both = task('both', '2026-01-01', { skillIds: ['s1', 's2'] })
    const none = task('none', '2026-01-02')
    const sections = groupBacklog([both, none], 'skill', tags)
    expect(sections.map((s) => [s.name, s.tasks.map((t) => t.id)])).toEqual([
      ['Anatomy', ['both']],
      ['Lights', ['both']],
      ['No skill', ['none']],
    ])
  })

  it('leaves the list whole when not grouping', () => {
    expect(groupBacklog([task('x', '2026-01-01')], 'none', tags)).toHaveLength(1)
  })
})
