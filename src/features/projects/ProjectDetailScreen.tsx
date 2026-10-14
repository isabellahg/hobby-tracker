import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { EmptyState } from '../../components/EmptyState'

export function ProjectDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const project = useAppStore((s) => s.projects.find((p) => p.id === id))
  const [nextAction, setNextAction] = useState(project?.nextAction ?? '')

  if (!project) return <EmptyState>Project not found.</EmptyState>

  async function saveNextAction() {
    await run({ operation: 'project.setNextAction', payload: { id: project!.id, nextAction } })
  }

  async function setStatus(status: 'active' | 'completed' | 'archived') {
    await run({ operation: 'project.update', payload: { id: project!.id, status } })
  }

  async function startSessionForProject() {
    const result = await run({ operation: 'session.start', payload: { projectId: project!.id } })
    if (result.success && result.changes[0]) navigate(`/session/${result.changes[0].id}`)
  }

  const completed = project.taskEntries.filter((e) => e.status === 'completed')
  const pending = project.taskEntries.filter((e) => e.status === 'pending')

  return (
    <div className="stack">
      <div className="page-header">
        <h2>{project.name}</h2>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={startSessionForProject}>
            Start a session for this project
          </button>
        </div>
      </div>

      <div className="card stack">
        <div className="field">
          <label htmlFor="next-action">Next action</label>
          <div className="row">
            <input
              id="next-action"
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
            <button type="button" className="btn" onClick={saveNextAction}>
              Save
            </button>
          </div>
        </div>
        <div className="row">
          <label className="muted" style={{ marginBottom: 0 }}>
            Status:
          </label>
          {(['active', 'completed', 'archived'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className="btn"
              style={{ background: project.status === s ? 'var(--accent-dim)' : undefined }}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Pending tasks ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="muted">Nothing pending — carried-forward unfinished tasks will appear here.</p>
        ) : (
          <ul>
            {pending.map((e) => (
              <li key={e.id}>
                {e.label} {e.carriedFromSessionId && <span className="chip">carried forward</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Completed ({completed.length})</h3>
        {completed.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul>
            {completed.map((e) => (
              <li key={e.id}>{e.label}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
