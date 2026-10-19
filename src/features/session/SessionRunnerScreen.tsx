import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { totalPausedMs } from '../../domain/logic/sessionLifecycle'
import { ProgressBar } from '../../components/ProgressBar'
import { DraggableList } from '../../components/DraggableList'
import { DurationTimer } from '../../components/DurationTimer'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { InlineEdit } from '../../components/InlineEdit'
import { ChildMeter, SubtaskQuickAdd } from '../../components/Subtasks'
import { EnterForm } from '../../components/EnterForm'
import { Panel } from '../../components/Panel'
import { TaskTagPicker } from '../../components/TaskTagPicker'
import { MediaStrip } from '../../components/MediaStrip'
import type { SessionTaskEntry } from '../../domain/types/session'
import { SessionSummaryCard } from './SessionSummaryCard'
import { sessionTitle } from './sessionTitle'

export function SessionRunnerScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useAppStore((s) => s.sessions.find((x) => x.id === id))
  const routines = useAppStore((s) => s.routines)
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const allTaskDefs = useAppStore((s) => s.taskDefs)
  const [adHocLabel, setAdHocLabel] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  /** Entry currently showing the "split into subtasks" input. */
  const [splittingEntryId, setSplittingEntryId] = useState<string | null>(null)

  if (!session) {
    return <EmptyState>Session not found.</EmptyState>
  }

  if (session.state === 'finished') {
    return <SessionSummaryCard session={session} />
  }

  if (session.state === 'discarded') {
    return (
      <EmptyState>
        This session was discarded and does not count as activity.{' '}
        <button type="button" className="btn" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </EmptyState>
    )
  }

  const completed = session.taskEntries.filter((e) => e.status === 'completed').length
  const entryIds = new Set(session.taskEntries.map((e) => e.id))
  const topEntries = session.taskEntries.filter((e) => !e.parentEntryId || !entryIds.has(e.parentEntryId))
  const childEntries = (parentId: string) =>
    session.taskEntries.filter((e) => e.parentEntryId === parentId).sort((a, b) => a.order - b.order)
  const childMeter = (parentId: string) => {
    const counted = childEntries(parentId).filter((e) => e.status !== 'skipped')
    return <ChildMeter done={counted.filter((e) => e.status === 'completed').length} total={counted.length} />
  }
  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((s) => !s.archived)
  const inSession = new Set(session.taskEntries.map((e) => e.taskDefId).filter(Boolean))
  const addableTasks = allTaskDefs
    .filter((t) => !t.archived && !inSession.has(t.id))
    .sort((a, b) => a.label.localeCompare(b.label))
  const toggleId = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  function setTags(hobbyIds: string[], skillIds: string[]) {
    run({ operation: 'session.setTags', payload: { sessionId: session!.id, hobbyIds, skillIds } })
  }
  const isPaused = session.pausedIntervals.some((p) => !p.resumedAt)
  const pausedSec = Math.floor(totalPausedMs(session, new Date()) / 1000)

  async function toggle(entryId: string) {
    await run({ operation: 'session.toggleTask', payload: { sessionId: session!.id, entryId } })
  }
  async function skip(entryId: string) {
    await run({ operation: 'session.skipTask', payload: { sessionId: session!.id, entryId } })
  }
  async function addAdHoc() {
    const label = adHocLabel.trim()
    if (!label) return
    await run({ operation: 'session.addAdHocTask', payload: { sessionId: session!.id, label, skillIds: [] } })
    setAdHocLabel('')
  }
  async function addSubtask(parentEntryId: string, label: string) {
    await run({ operation: 'session.addSubtask', payload: { sessionId: session!.id, parentEntryId, label } })
  }
  async function reorder(orderedEntryIds: string[]) {
    await run({ operation: 'session.reorderTasks', payload: { sessionId: session!.id, orderedEntryIds } })
  }
  async function togglePause() {
    await run({ operation: isPaused ? 'session.resume' : 'session.pause', payload: { sessionId: session!.id } })
  }
  async function finish() {
    await run({ operation: 'session.finish', payload: { sessionId: session!.id } })
  }
  async function discard() {
    await run({ operation: 'session.discard', payload: { sessionId: session!.id } })
    setConfirmingDiscard(false)
    navigate('/')
  }

  function entryCheckbox(entry: SessionTaskEntry) {
    return (
      <input
        type="checkbox"
        aria-label={`Done: ${entry.label}`}
        checked={entry.status === 'completed'}
        disabled={entry.status === 'skipped'}
        onChange={() => toggle(entry.id)}
      />
    )
  }

  function entryLabel(entry: SessionTaskEntry, extraClass = '') {
    return (
      <InlineEdit
        value={entry.label}
        ariaLabel="Task name"
        onSave={(label) =>
          run({ operation: 'session.renameTask', payload: { sessionId: session!.id, entryId: entry.id, label } })
        }
        className={`${extraClass}${entry.status === 'completed' ? ' is-done' : ''}`.trim() || undefined}
      />
    )
  }

  /** Subtask entries nested under `entry`, plus the quick-add input while splitting it. */
  function subtree(entry: SessionTaskEntry) {
    const children = childEntries(entry.id)
    if (children.length === 0 && splittingEntryId !== entry.id) return null
    return (
      <ul className="subtree">
        {children.map((child) => (
          <li key={child.id} className={child.status === 'skipped' ? 'is-skipped' : undefined}>
            <div className="subtask-row">
              {entryCheckbox(child)}
              {entryLabel(child, 'grow')}
              {childMeter(child.id)}
              {child.status !== 'skipped' && (
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Split into subtasks"
                    aria-label={`Add a subtask to ${child.label}`}
                    onClick={() => setSplittingEntryId(child.id)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Skip"
                    aria-label={`Skip ${child.label}`}
                    onClick={() => skip(child.id)}
                  >
                    ⤼
                  </button>
                </>
              )}
            </div>
            {subtree(child)}
          </li>
        ))}
        {splittingEntryId === entry.id && (
          <li>
            <SubtaskQuickAdd onAdd={(label) => addSubtask(entry.id, label)} onClose={() => setSplittingEntryId(null)} />
          </li>
        )}
      </ul>
    )
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="page-subtitle">
            Session in progress
          </div>
          <h2>
            <InlineEdit
              value={sessionTitle(session, routines)}
              ariaLabel="Session name"
              onSave={(name) => run({ operation: 'session.rename', payload: { sessionId: session.id, name } })}
            />
          </h2>
        </div>
        <div className="row">
          <span className="chip">
            <DurationTimer startedAt={session.startedAt} pausedSec={pausedSec} isPaused={isPaused} />
          </span>
          <button type="button" className="btn" onClick={togglePause}>
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      <ProgressBar completed={completed} total={session.taskEntries.length} />

      {session.taskEntries.length === 0 && (
        <EmptyState>No tasks yet — add one below, or finish as a free-form session.</EmptyState>
      )}

      <DraggableList
        items={topEntries}
        onReorder={reorder}
        renderItem={(entry) => (
          <div className={`card card-tight${entry.status === 'skipped' ? ' is-skipped' : ''}`}>
            <div className="row row-between">
              <div className="row grow">
                {entryCheckbox(entry)}
                {entryLabel(entry)}
                {entry.isAdHoc && <span className="chip">ad-hoc</span>}
                {childMeter(entry.id)}
                {entry.status !== 'skipped' && splittingEntryId !== entry.id && (
                  <button type="button" className="split-link" onClick={() => setSplittingEntryId(entry.id)}>
                    {childEntries(entry.id).length ? '+ subtask' : '+ split'}
                  </button>
                )}
              </div>
              {entry.status !== 'skipped' && (
                <button type="button" className="btn" onClick={() => skip(entry.id)}>
                  Skip
                </button>
              )}
            </div>
            <MediaStrip taskDefId={entry.taskDefId} />
            {subtree(entry)}
          </div>
        )}
      />

      <div className="card stack stack-sm">
        <EnterForm className="row" onSubmit={addAdHoc}>
          <input
            type="text"
            enterKeyHint="go"
            aria-label="New task for this session"
            placeholder="Add a task to this session"
            value={adHocLabel}
            onChange={(e) => setAdHocLabel(e.target.value)}
          />
          <button type="submit" className="btn">
            Add
          </button>
        </EnterForm>
        {addableTasks.length > 0 && (
          <select
            aria-label="Add a task from your backlog"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                run({ operation: 'session.addTask', payload: { sessionId: session.id, taskDefId: e.target.value } })
              }
            }}
          >
            <option value="">+ from your backlog…</option>
            {addableTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <Panel
        title="Tags"
        icon="#"
        defaultOpen={session.hobbyIds.length + session.skillIds.length === 0}
        description="What did this session practise? Tasks from your backlog bring their own tags."
      >
        <TaskTagPicker
          hobbies={hobbies}
          skills={skills}
          selectedHobbyIds={session.hobbyIds}
          selectedSkillIds={session.skillIds}
          onToggleHobby={(id) => setTags(toggleId(session.hobbyIds, id), session.skillIds)}
          onToggleSkill={(id) => setTags(session.hobbyIds, toggleId(session.skillIds, id))}
        />
      </Panel>

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={finish}>
          Finish session
        </button>
        <button type="button" className="btn btn-danger" onClick={() => setConfirmingDiscard(true)}>
          Discard
        </button>
      </div>

      {confirmingDiscard && (
        <ConfirmDialog
          title="Discard this session?"
          confirmLabel="Discard"
          danger
          onConfirm={discard}
          onCancel={() => setConfirmingDiscard(false)}
        >
          <p>This will not count as activity and cannot be recovered.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
