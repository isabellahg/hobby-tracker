import type { TaskKind } from '../domain/types/taskDef'

export const KIND_OPTIONS: { kind: TaskKind; label: string; hint: string }[] = [
  { kind: 'once', label: 'One-off', hint: 'leaves once you complete it' },
  { kind: 'recurring', label: 'Habit', hint: 'lives in Habits; rated by how often you do it' },
  { kind: 'ongoing', label: 'Ongoing', hint: 'e.g. a course; stays until marked finished' },
]

export function kindLabel(kind: TaskKind): string {
  return KIND_OPTIONS.find((o) => o.kind === kind)?.label ?? kind
}
