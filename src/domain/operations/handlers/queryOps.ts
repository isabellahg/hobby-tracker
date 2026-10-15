import { computeDayMarks } from '../../logic/dayMark'
import { computeWeekStreak } from '../../logic/weekStreak'
import { hobbyRepo, recordRepo, sessionRepo, skillRepo } from '../../../storage/repositories'
import type { ChangedRecord } from '../envelope'
import type { OperationContext } from '../context'
import type { queryCalendarSchema, queryHistorySchema, queryProgressSchema } from '../validate/query'
import type { z } from 'zod'

export async function handleQueryCalendar(
  payload: z.infer<typeof queryCalendarSchema>,
  ctx: OperationContext,
): Promise<{ changes: ChangedRecord[]; summary: string; data: unknown }> {
  const sessions = await sessionRepo.getAll()
  const marks = computeDayMarks(sessions, { start: payload.start, end: payload.end })
  const streak = computeWeekStreak(sessions, ctx.now)
  return { changes: [], summary: 'Calendar + streak snapshot', data: { marks, streak } }
}

export async function handleQueryHistory(
  payload: z.infer<typeof queryHistorySchema>,
): Promise<{ changes: ChangedRecord[]; summary: string; data: unknown }> {
  let sessions = await sessionRepo.getAll()
  sessions = sessions.filter((s) => s.state !== 'in_progress')
  if (payload.start) sessions = sessions.filter((s) => s.dateKey >= payload.start!)
  if (payload.end) sessions = sessions.filter((s) => s.dateKey <= payload.end!)
  if (payload.routineId) sessions = sessions.filter((s) => s.routineId === payload.routineId)
  if (payload.hobbyId) sessions = sessions.filter((s) => s.hobbyIds.includes(payload.hobbyId!))
  if (payload.skillId) sessions = sessions.filter((s) => s.skillIds.includes(payload.skillId!))
  sessions.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
  return { changes: [], summary: `${sessions.length} session(s) matched`, data: { sessions } }
}

export async function handleQueryProgress(
  payload: z.infer<typeof queryProgressSchema>,
): Promise<{ changes: ChangedRecord[]; summary: string; data: unknown }> {
  let sessions = (await sessionRepo.getAll()).filter((s) => s.state === 'finished')
  if (payload.hobbyId) sessions = sessions.filter((s) => s.hobbyIds.includes(payload.hobbyId!))
  if (payload.skillId) sessions = sessions.filter((s) => s.skillIds.includes(payload.skillId!))

  let records = await recordRepo.getAll()
  if (payload.hobbyId) records = records.filter((r) => r.hobbyId === payload.hobbyId)
  if (payload.skillId) records = records.filter((r) => r.skillId === payload.skillId)

  const [hobbies, skills] = await Promise.all([hobbyRepo.getAll(), skillRepo.getAll()])

  const sessionCountBySkill: Record<string, number> = {}
  for (const s of sessions) {
    for (const skillId of s.skillIds) {
      sessionCountBySkill[skillId] = (sessionCountBySkill[skillId] ?? 0) + 1
    }
  }

  return {
    changes: [],
    summary: `${sessions.length} finished session(s), ${records.length} milestone(s)`,
    data: {
      sessionCountBySkill,
      records: records.sort((a, b) => (a.date < b.date ? 1 : -1)),
      hobbies,
      skills,
    },
  }
}
