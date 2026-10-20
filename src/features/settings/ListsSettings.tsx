import { useState } from 'react'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { EnterForm } from '../../components/EnterForm'
import { InlineEdit } from '../../components/InlineEdit'
import { ArchivedSection } from '../../components/ArchivedSection'

/** Make, rename, order and archive your lists. They show up in the sidebar by name. */
export function ListsSettings() {
  const lists = useAppStore((s) => s.lists)
  const taskDefs = useAppStore((s) => s.taskDefs)
  const [name, setName] = useState('')
  const open = lists.filter((l) => !l.archived).sort((a, b) => a.order - b.order)
  const archived = lists.filter((l) => l.archived)

  async function create() {
    if (!name.trim()) return
    await run({ operation: 'list.create', payload: { name: name.trim() } })
    setName('')
  }

  function move(index: number, by: -1 | 1) {
    const ids = open.map((l) => l.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + by, 0, id)
    run({ operation: 'list.reorder', payload: { orderedIds: ids } })
  }

  return (
    <div className="card stack stack-sm">
      <h3 className="m0">Lists</h3>
      <p className="desc m0">
        Reading lists, watch lists, anything. Each one gets its own page in the sidebar. Habits are built in.
      </p>
      <EnterForm className="row" onSubmit={create}>
        <input
          type="text"
          enterKeyHint="go"
          aria-label="New list name"
          placeholder="e.g. Reading list"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn">
          Create list
        </button>
      </EnterForm>
      <ul className="list-plain">
        {open.map((list, i) => {
          const count = taskDefs.filter((t) => t.listId === list.id && !t.archived).length
          return (
            <li key={list.id} className="list-row">
              <span className="dot dot-violet" />
              <span className="grow">
                <InlineEdit
                  value={list.name}
                  ariaLabel="List name"
                  onSave={(next) => run({ operation: 'list.rename', payload: { id: list.id, name: next } })}
                />
              </span>
              <span className="list-row-meta">{count}</span>
              <button type="button" className="icon-btn" aria-label={`Move ${list.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move ${list.name} down`}
                disabled={i === open.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn"
                title="Hide the list and its items; restore any time"
                onClick={() => run({ operation: 'list.archive', payload: { id: list.id, archived: true } })}
              >
                Archive
              </button>
            </li>
          )
        })}
      </ul>
      <ArchivedSection
        title="Archived lists"
        items={archived.map((l) => ({ id: l.id, label: l.name }))}
        onRestore={(id) => run({ operation: 'list.archive', payload: { id, archived: false } })}
      />
    </div>
  )
}
