import { useState, type ClipboardEvent } from 'react'
import type { TaskDef, TaskKind } from '../domain/types/taskDef'
import { useAppStore } from '../state/store'
import { run } from '../state/actions'
import { TaskTagPicker } from './TaskTagPicker'
import { EnterForm } from './EnterForm'
import { MediaEditor } from './MediaEditor'
import { descendantsOf } from '../domain/logic/taskTree'
import { takePaste } from '../lib/attachments'
import { saveAttachment } from '../state/attachments'

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

/** Edits an existing task's label, type, hobby/skill tags, parent, and next action. */
export function TaskEditor({ task, onDone }: { task: TaskDef; onDone: () => void }) {
  const allHobbies = useAppStore((s) => s.hobbies)
  const allSkills = useAppStore((s) => s.skills)
  const allTaskDefs = useAppStore((s) => s.taskDefs)
  const hobbies = allHobbies.filter((h) => !h.archived)
  const skills = allSkills.filter((s) => !s.archived)

  const [label, setLabel] = useState(task.label)
  const [kind, setKind] = useState<TaskKind>(task.kind)
  const [hobbyIds, setHobbyIds] = useState(task.hobbyIds)
  const [skillIds, setSkillIds] = useState(task.skillIds)
  const [nextAction, setNextAction] = useState(task.nextAction ?? '')
  const [parentId, setParentId] = useState(task.parentId ?? '')
  const [error, setError] = useState<string | null>(null)

  // Any open task except itself and its own subtree can become the parent.
  const excluded = new Set([task.id, ...descendantsOf(allTaskDefs, task.id).map((t) => t.id)])
  const parentOptions = allTaskDefs
    .filter((t) => !t.archived && !excluded.has(t.id))
    .sort((a, b) => a.label.localeCompare(b.label))

  async function save() {
    if (!label.trim()) {
      setError('The task needs a name.')
      return
    }
    const result = await run({
      operation: 'taskDef.update',
      payload: {
        id: task.id,
        label: label.trim(),
        kind,
        hobbyIds,
        skillIds,
        nextAction: kind === 'ongoing' ? nextAction.trim() : undefined,
        ...(parentId !== (task.parentId ?? '') && { parentId: parentId || null }),
      },
    })
    if (!result.success) {
      setError(result.errors?.[0]?.message ?? 'Could not save the task.')
      return
    }
    onDone()
  }

  // A pasted link or picture anywhere in the editor is attached instead of typed.
  function handlePaste(e: ClipboardEvent) {
    takePaste(e)
      ?.then((list) => Promise.all(list.map((a) => saveAttachment(task.id, a))))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not attach that'))
  }

  const formId = `task-edit-${task.id}`
  return (
    <div onClick={(e) => e.stopPropagation()} onPaste={handlePaste}>
      <EnterForm id={formId} onSubmit={save}>
      <div className="field">
        <label htmlFor={`task-label-${task.id}`}>Name</label>
        <input
          id={`task-label-${task.id}`}
          type="text"
          enterKeyHint="done"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <TaskTagPicker
        hobbies={hobbies}
        skills={skills}
        selectedHobbyIds={hobbyIds}
        selectedSkillIds={skillIds}
        kind={kind}
        onToggleHobby={(id) => setHobbyIds((ids) => toggle(ids, id))}
        onToggleSkill={(id) => setSkillIds((ids) => toggle(ids, id))}
        onChangeKind={setKind}
      />
      {kind === 'ongoing' && (
        <div className="field">
          <label htmlFor={`task-next-${task.id}`}>Next action</label>
          <input
            id={`task-next-${task.id}`}
            type="text"
            placeholder="e.g. Chapter 7 — torso"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor={`task-parent-${task.id}`}>Subtask of</label>
        <select id={`task-parent-${task.id}`} value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">— nothing (top level) —</option>
          {parentOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      </EnterForm>
      <MediaEditor taskDefId={task.id} />
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" form={formId} className="btn btn-primary">
          Save
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}
