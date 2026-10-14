import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { EmptyState } from '../../components/EmptyState'

export function ProjectListScreen() {
  const projects = useAppStore((s) => s.projects)
  const hobbies = useAppStore((s) => s.hobbies)
  const [name, setName] = useState('')

  async function createProject() {
    if (!name.trim()) return
    await run({ operation: 'project.create', payload: { name: name.trim(), hobbyIds: [], skillIds: [] } })
    setName('')
  }

  const hobbyById = new Map(hobbies.map((h) => [h.id, h]))
  const active = projects.filter((p) => p.status === 'active')
  const others = projects.filter((p) => p.status !== 'active')

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Projects</h2>
      </div>

      <div className="card row">
        <input
          type="text"
          placeholder="New project (e.g. Boss recreation)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createProject()}
        />
        <button type="button" className="btn btn-primary" onClick={createProject}>
          Create
        </button>
      </div>

      {active.length === 0 && others.length === 0 && (
        <EmptyState>
          Projects group tasks and sessions toward a longer-term goal spanning hobbies/skills.
        </EmptyState>
      )}

      <div className="stack">
        {active.map((p) => {
          const completed = p.taskEntries.filter((e) => e.status === 'completed').length
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <strong>{p.name}</strong>
                  {p.hobbyIds.length > 0 && (
                    <span className="muted">
                      {' '}
                      · {p.hobbyIds.map((id) => hobbyById.get(id)?.name).filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
                <span className="muted">
                  {completed}/{p.taskEntries.length} tasks
                </span>
              </div>
              {p.nextAction && <p className="muted" style={{ margin: '0.4rem 0 0' }}>Next: {p.nextAction}</p>}
            </Link>
          )
        })}
      </div>

      {others.length > 0 && (
        <details>
          <summary className="muted">Completed / archived ({others.length})</summary>
          <div className="stack" style={{ marginTop: '0.5rem' }}>
            {others.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                {p.name} <span className="muted">({p.status})</span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
