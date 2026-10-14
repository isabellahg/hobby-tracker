import { describe, expect, it } from 'vitest'
import type { Project } from '../types/project'
import { attachCarryForwardToProject, buildCarryForwardEntries } from './carryForward'
import { makeSession } from './testHelpers'

describe('buildCarryForwardEntries', () => {
  it('carries only pending entries, not completed or skipped ones', () => {
    const session = makeSession('2026-10-06', 'finished', {
      taskEntries: [
        { id: 't1', label: 'pending one', hobbyIds: [], skillIds: [], status: 'pending', order: 0, isAdHoc: false },
        { id: 't2', label: 'done one', hobbyIds: [], skillIds: [], status: 'completed', order: 1, isAdHoc: false },
        { id: 't3', label: 'skipped one', hobbyIds: [], skillIds: [], status: 'skipped', order: 2, isAdHoc: false },
      ],
    })
    const carried = buildCarryForwardEntries(session)
    expect(carried).toHaveLength(1)
    expect(carried[0].label).toBe('pending one')
    expect(carried[0].carriedFromSessionId).toBe(session.id)
    expect(carried[0].id).not.toBe('t1') // fresh id
  })
})

describe('attachCarryForwardToProject', () => {
  it('appends to, rather than replaces, the existing task list', () => {
    const project: Project = {
      id: 'p1',
      name: 'Boss recreation',
      hobbyIds: [],
      skillIds: [],
      status: 'active',
      taskEntries: [
        { id: 'existing', label: 'already here', hobbyIds: [], skillIds: [], status: 'completed', order: 0, isAdHoc: false },
      ],
      createdAt: '',
      updatedAt: '',
    }
    const session = makeSession('2026-10-06', 'finished', {
      taskEntries: [
        { id: 't1', label: 'carry me', hobbyIds: [], skillIds: [], status: 'pending', order: 0, isAdHoc: false },
      ],
    })
    const carried = buildCarryForwardEntries(session)
    const updated = attachCarryForwardToProject(project, carried)
    expect(updated.taskEntries).toHaveLength(2)
    expect(updated.taskEntries[0].status).toBe('completed') // untouched
    expect(updated.taskEntries[1].label).toBe('carry me')
    expect(updated.taskEntries[1].carriedFromProjectId).toBe('p1')
  })

  it('is a no-op when there is nothing to carry', () => {
    const project: Project = {
      id: 'p1', name: 'x', hobbyIds: [], skillIds: [], status: 'active',
      taskEntries: [], createdAt: '', updatedAt: '',
    }
    expect(attachCarryForwardToProject(project, [])).toBe(project)
  })
})
