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
import { SessionSummaryCard } from './SessionSummaryCard'
import { sessionTitle } from './sessionTitle'

export function SessionRunnerScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useAppStore((s) => s.sessions.find((x) => x.id === id))
  const routines = useAppStore((s) => s.routines)
  const [adHocLabel, setAdHocLabel] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

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

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Session in progress
          </div>
          <h2 style={{ margin: 0 }}>
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
        items={session.taskEntries}
        onReorder={reorder}
        renderItem={(entry) => (
          <div
            className="row card"
            style={{
              justifyContent: 'space-between',
              opacity: entry.status === 'skipped' ? 0.5 : 1,
            }}
          >
            <div className="row" style={{ gap: '0.6rem', flex: 1 }}>
              <input
                type="checkbox"
                aria-label={`Done: ${entry.label}`}
                checked={entry.status === 'completed'}
                disabled={entry.status === 'skipped'}
                onChange={() => toggle(entry.id)}
              />
              <InlineEdit
                value={entry.label}
                ariaLabel="Task name"
                onSave={(label) =>
                  run({ operation: 'session.renameTask', payload: { sessionId: session.id, entryId: entry.id, label } })
                }
                style={{ textDecoration: entry.status === 'completed' ? 'line-through' : undefined }}
              />
              {entry.isAdHoc && <span className="chip">ad-hoc</span>}
            </div>
            {entry.status !== 'skipped' && (
              <button type="button" className="btn" onClick={() => skip(entry.id)}>
                Skip
              </button>
            )}
          </div>
        )}
      />

      <div className="card row">
        <input
          type="text"
          placeholder="Add a task to this session"
          value={adHocLabel}
          onChange={(e) => setAdHocLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addAdHoc()}
        />
        <button type="button" className="btn" onClick={addAdHoc}>
          Add
        </button>
      </div>

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
