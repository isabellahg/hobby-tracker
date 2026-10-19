import { z } from 'zod'

export const sessionStartSchema = z.object({
  routineId: z.string().optional(),
  /** Backdates the session (e.g. logging a session from yesterday). Defaults to now. */
  occurredAt: z.string().optional(),
})

export const sessionEntryIdSchema = z.object({
  sessionId: z.string().min(1),
  entryId: z.string().min(1),
})

export const sessionSetTaskStatusSchema = z.object({
  sessionId: z.string().min(1),
  /** Matched by exact label — lets a caller mark a task done without knowing its internal entry id. */
  label: z.string().min(1),
  status: z.enum(['pending', 'completed', 'skipped']),
})

export const sessionAddAdHocTaskSchema = z.object({
  sessionId: z.string().min(1),
  label: z.string().min(1),
  hobbyIds: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
})

export const sessionReorderTasksSchema = z.object({
  sessionId: z.string().min(1),
  orderedEntryIds: z.array(z.string()).min(1),
})

export const sessionIdSchema = z.object({
  sessionId: z.string().min(1),
})

export const sessionFinishSchema = z.object({
  sessionId: z.string().min(1),
  /** Backdates when the session finished (e.g. logging a session from yesterday). Defaults to now. */
  finishedAt: z.string().optional(),
})

export const sessionStartFromBucketSchema = z.object({
  bucketId: z.string().min(1),
  occurredAt: z.string().optional(),
})

/** Adds an existing library task (and its open subtasks) to a session in progress. */
export const sessionAddTaskSchema = z.object({
  sessionId: z.string().min(1),
  taskDefId: z.string().min(1),
})

/** Same shape as addTask, but the task goes in already completed — finished sessions included. */
export const sessionLogCompletedTaskSchema = sessionAddTaskSchema

/** Replaces the session's hobby/skill tags — how a flexible session gets tagged. */
export const sessionSetTagsSchema = z.object({
  sessionId: z.string().min(1),
  hobbyIds: z.array(z.string()),
  skillIds: z.array(z.string()),
})

export const sessionRenameSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().min(1),
})

export const sessionRenameTaskSchema = z.object({
  sessionId: z.string().min(1),
  entryId: z.string().min(1),
  label: z.string().min(1),
})

export const sessionAddSubtaskSchema = z.object({
  sessionId: z.string().min(1),
  parentEntryId: z.string().min(1),
  label: z.string().min(1),
})
