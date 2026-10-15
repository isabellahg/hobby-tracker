import { describe, expect, it } from 'vitest'
import type { Routine } from '../types/routine'
import type { TaskDef } from '../types/taskDef'
import {
  addAdHocTask,
  discardSession,
  finishSession,
  pauseSession,
  resumeSession,
  reorderTasks,
  skipTask,
  startSession,
  toggleTask,
} from './sessionLifecycle'

const NOW = new Date('2026-10-13T10:00:00.000Z')

function makeRoutine(): { routine: Routine; taskDefsById: Map<string, TaskDef> } {
  const defs: TaskDef[] = [
    { id: 'td1', label: 'Reference gathering', hobbyIds: [], skillIds: ['s1'], kind: 'once', archived: false, createdAt: '', updatedAt: '' },
    { id: 'td2', label: 'Sketch', hobbyIds: [], skillIds: ['s1', 's2'], kind: 'once', archived: false, createdAt: '', updatedAt: '' },
  ]
  const routine: Routine = {
    id: 'r1',
    name: 'Boss recreation',
    hobbyIds: ['h1'],
    skillIds: ['s1', 's2'],
    taskRefs: [
      { id: 'ref1', taskDefId: 'td1', order: 0 },
      { id: 'ref2', taskDefId: 'td2', order: 1 },
    ],
    archived: false,
    createdAt: '',
    updatedAt: '',
  }
  return { routine, taskDefsById: new Map(defs.map((d) => [d.id, d])) }
}

describe('startSession', () => {
  it('seeds the checklist from the routine in order', () => {
    const { routine, taskDefsById } = makeRoutine()
    const session = startSession({ routine, taskDefsById, now: NOW })
    expect(session.taskEntries.map((e) => e.label)).toEqual(['Reference gathering', 'Sketch'])
    expect(session.taskEntries.every((e) => e.status === 'pending')).toBe(true)
    expect(session.state).toBe('in_progress')
  })

  it('seeds the checklist from an ad-hoc taskDef list (e.g. a plan bucket) with no routine', () => {
    const { taskDefsById } = makeRoutine()
    const session = startSession({ taskDefsById, adHocTaskDefIds: ['td2', 'td1'], now: NOW })
    expect(session.routineId).toBeUndefined()
    expect(session.taskEntries.map((e) => e.label)).toEqual(['Sketch', 'Reference gathering'])
    expect(session.skillIds.sort()).toEqual(['s1', 's2'])
  })

  it('starts empty for a flexible session with no routine', () => {
    const session = startSession({ taskDefsById: new Map(), now: NOW })
    expect(session.taskEntries).toEqual([])
    expect(session.routineId).toBeUndefined()
  })
})

describe('finishSession', () => {
  it('finishes even at 0% completion and still reports it as finished', () => {
    const { routine, taskDefsById } = makeRoutine()
    const session = startSession({ routine, taskDefsById, now: NOW })
    const finishTime = new Date(NOW.getTime() + 5 * 60_000)
    const { session: finished, unfinishedEntries } = finishSession(session, finishTime)
    expect(finished.state).toBe('finished')
    expect(unfinishedEntries).toHaveLength(2)
  })

  it('distinguishes "finished" from "all tasks completed"', () => {
    const { routine, taskDefsById } = makeRoutine()
    let session = startSession({ routine, taskDefsById, now: NOW })
    session = toggleTask(session, session.taskEntries[0].id, NOW)
    const { session: finished, unfinishedEntries } = finishSession(session, NOW)
    expect(finished.state).toBe('finished')
    expect(unfinishedEntries).toHaveLength(1)
    expect(finished.taskEntries.some((e) => e.status === 'completed')).toBe(true)
  })

  it('excludes paused time from the recorded duration', () => {
    const { routine, taskDefsById } = makeRoutine()
    let session = startSession({ routine, taskDefsById, now: NOW })
    session = pauseSession(session, new Date(NOW.getTime() + 60_000)) // paused at +1min
    session = resumeSession(session, new Date(NOW.getTime() + 6 * 60_000)) // resumed at +6min (5 min paused)
    const finishTime = new Date(NOW.getTime() + 10 * 60_000) // +10min total elapsed
    const { session: finished } = finishSession(session, finishTime)
    // 10 min elapsed - 5 min paused = 5 min = 300s
    expect(finished.durationSec).toBe(300)
  })
})

describe('discardSession', () => {
  it('marks the session discarded, distinct from finished', () => {
    const { routine, taskDefsById } = makeRoutine()
    const session = startSession({ routine, taskDefsById, now: NOW })
    const discarded = discardSession(session, NOW)
    expect(discarded.state).toBe('discarded')
    expect(discarded.discardedAt).toBeDefined()
  })
})

describe('checklist editing', () => {
  it('toggling twice returns a task to pending', () => {
    const { routine, taskDefsById } = makeRoutine()
    let session = startSession({ routine, taskDefsById, now: NOW })
    const id = session.taskEntries[0].id
    session = toggleTask(session, id, NOW)
    expect(session.taskEntries[0].status).toBe('completed')
    session = toggleTask(session, id, NOW)
    expect(session.taskEntries[0].status).toBe('pending')
  })

  it('skip marks a task skipped without affecting others', () => {
    const { routine, taskDefsById } = makeRoutine()
    let session = startSession({ routine, taskDefsById, now: NOW })
    session = skipTask(session, session.taskEntries[0].id)
    expect(session.taskEntries[0].status).toBe('skipped')
    expect(session.taskEntries[1].status).toBe('pending')
  })

  it('adds an ad-hoc task and folds its hobby/skill tags into the session', () => {
    let session = startSession({ taskDefsById: new Map(), now: NOW })
    session = addAdHocTask(session, 'Warm up', ['h9'], ['s9'])
    expect(session.taskEntries).toHaveLength(1)
    expect(session.taskEntries[0].isAdHoc).toBe(true)
    expect(session.hobbyIds).toContain('h9')
    expect(session.skillIds).toContain('s9')
  })

  it('reorders tasks by the given id sequence', () => {
    const { routine, taskDefsById } = makeRoutine()
    let session = startSession({ routine, taskDefsById, now: NOW })
    const [first, second] = session.taskEntries
    session = reorderTasks(session, [second.id, first.id])
    expect(session.taskEntries.map((e) => e.id)).toEqual([second.id, first.id])
  })
})
