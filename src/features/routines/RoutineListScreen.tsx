import { Link, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { EmptyState } from '../../components/EmptyState'

export function RoutineListScreen() {
  const allRoutines = useAppStore((s) => s.routines)
  const hobbies = useAppStore((s) => s.hobbies)
  const routines = allRoutines.filter((r) => !r.archived)
  const navigate = useNavigate()
  const hobbyById = new Map(hobbies.map((h) => [h.id, h]))

  async function startFromRoutine(routineId: string) {
    const result = await run({ operation: 'session.start', payload: { routineId } })
    if (result.success && result.changes[0]) navigate(`/session/${result.changes[0].id}`)
  }

  async function duplicate(id: string) {
    await run({ operation: 'routine.duplicate', payload: { id } })
  }

  async function archive(id: string) {
    await run({ operation: 'routine.archive', payload: { id, archived: true } })
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Routines</h2>
        <Link to="/routines/new" className="btn btn-primary">
          New routine
        </Link>
      </div>

      {routines.length === 0 && (
        <EmptyState>No routines yet. A routine is a reusable, ordered task list.</EmptyState>
      )}

      <div className="stack">
        {routines.map((r) => (
          <div key={r.id} className="card stack">
            <div className="page-header" style={{ marginBottom: 0 }}>
              <div>
                <h3 style={{ margin: 0 }}>{r.name}</h3>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {r.taskRefs.length} task(s)
                  {r.hobbyIds.length > 0 &&
                    ` · ${r.hobbyIds.map((id) => hobbyById.get(id)?.name).filter(Boolean).join(', ')}`}
                </div>
              </div>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => startFromRoutine(r.id)}>
                  Start
                </button>
                <Link to={`/routines/${r.id}`} className="btn">
                  Edit
                </Link>
                <button type="button" className="btn" onClick={() => duplicate(r.id)}>
                  Duplicate
                </button>
                <button type="button" className="btn btn-danger" onClick={() => archive(r.id)}>
                  Archive
                </button>
              </div>
            </div>
            {r.description && <p className="muted" style={{ margin: 0 }}>{r.description}</p>}
          </div>
        ))}
      </div>

      <div className="card">
        <button
          type="button"
          className="btn"
          onClick={async () => {
            const result = await run({ operation: 'session.start', payload: {} })
            if (result.success && result.changes[0]) navigate(`/session/${result.changes[0].id}`)
          }}
        >
          Start a flexible session (no routine)
        </button>
      </div>
    </div>
  )
}
