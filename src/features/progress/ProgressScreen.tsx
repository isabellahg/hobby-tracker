import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addMonths, format, parseISO, startOfMonth } from 'date-fns'
import { useAppStore } from '../../state/store'
import { run } from '../../state/actions'
import { isQualifyingSession } from '../../domain/logic/qualifyingSession'
import { toISODate } from '../../domain/logic/weekUtils'
import { InlineEdit } from '../../components/InlineEdit'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Chip } from '../../components/Chip'
import { Panel } from '../../components/Panel'
import { sessionTitle } from '../session/sessionTitle'
import { EnterForm } from '../../components/EnterForm'
import { MonthCalendar } from '../../components/Calendar/MonthCalendar'
import { HeatLegend, YearHeatmap } from '../../components/Calendar/YearHeatmap'
import { BarChart } from '../../components/BarChart'
import {
  activityByDate,
  isValidISODate,
  periodTotals,
  timeByTag,
  type ActivityFilter,
  type DayActivity,
  type PeriodUnit,
} from '../../domain/logic/activity'
import { formatDuration } from '../../lib/format'

type Tab = 'calendar' | 'charts' | 'tasks' | 'records'

const TABS: { id: Tab; label: string }[] = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'charts', label: 'Charts' },
  { id: 'tasks', label: 'Task completion' },
  { id: 'records', label: 'Milestones' },
]

function isTab(value: string | null): value is Tab {
  return TABS.some((t) => t.id === value)
}

/** Bar labels: "0.5h", "6.2h", "14h". */
function hours(sec: number): string {
  const h = sec / 3600
  return h < 10 ? `${Math.round(h * 10) / 10}h` : `${Math.round(h)}h`
}

function sumWhere(byDate: Map<string, DayActivity>, keep: (date: string) => boolean) {
  let sec = 0
  let sessions = 0
  let days = 0
  for (const [date, day] of byDate) {
    if (!keep(date)) continue
    sec += day.sec
    sessions += day.sessionIds.length
    days += 1
  }
  return { sec, sessions, days }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function BarRows({ rows }: { rows: { id: string; name: string; sec: number; sessions: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.sec))
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="bar-row">
          <span className="bar-label">{r.name}</span>
          <span className="bar-count">
            {formatDuration(r.sec)} · {plural(r.sessions, 'session')}
          </span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(r.sec / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProgressScreen() {
  const sessions = useAppStore((s) => s.sessions)
  const skills = useAppStore((s) => s.skills)
  const hobbies = useAppStore((s) => s.hobbies)
  const routines = useAppStore((s) => s.routines)
  const records = useAppStore((s) => s.personalRecords)
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: Tab = isTab(tabParam) ? tabParam : 'calendar'
  const [now] = useState(() => new Date())
  const todayKey = format(now, 'yyyy-MM-dd')
  const dateParam = params.get('date')
  const selected = isValidISODate(dateParam) ? dateParam : todayKey
  const [monthStart, setMonthStart] = useState(() => startOfMonth(parseISO(selected)))
  const [year, setYear] = useState(() => parseISO(selected).getFullYear())
  const [filterKey, setFilterKey] = useState('')
  const [unit, setUnit] = useState<PeriodUnit>('week')
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)
  const hobbyById = new Map(hobbies.map((h) => [h.id, h]))
  const skillById = new Map(skills.map((s) => [s.id, s]))

  const qualifying = useMemo(() => sessions.filter(isQualifyingSession), [sessions])
  const timeBySkill = useMemo(() => timeByTag(qualifying, (s) => s.skillIds), [qualifying])
  const timeByHobby = useMemo(() => timeByTag(qualifying, (s) => s.hobbyIds), [qualifying])

  const skillRows = skills
    .filter((sk) => !sk.archived)
    .map((sk) => ({ id: sk.id, name: sk.name, ...(timeBySkill[sk.id] ?? { sec: 0, sessions: 0 }) }))
    .sort((a, b) => b.sec - a.sec || b.sessions - a.sessions)
  const hobbyRows = hobbies
    .filter((h) => !h.archived)
    .map((h) => ({ id: h.id, name: h.name, ...(timeByHobby[h.id] ?? { sec: 0, sessions: 0 }) }))
    .sort((a, b) => b.sec - a.sec || b.sessions - a.sessions)
  const untouchedSkills = skillRows.filter((r) => r.sessions === 0)

  // "h:<id>" / "s:<id>" narrows the calendar and the charts to one tag.
  const byDate = useMemo(() => {
    const filter: ActivityFilter = filterKey.startsWith('h:')
      ? { hobbyId: filterKey.slice(2) }
      : filterKey.startsWith('s:')
        ? { skillId: filterKey.slice(2) }
        : {}
    return activityByDate(sessions, filter)
  }, [sessions, filterKey])
  const periods = useMemo(() => periodTotals(byDate, unit, 12, now), [byDate, unit, now])
  const periodSum = periods.reduce((acc, p) => acc + p.sec, 0)
  const current = periods[periods.length - 1]
  // Weeks: day number, with the month only where it changes. Months: name, with the year where it changes.
  const axis = periods.map((p, i) => {
    const d = parseISO(p.start)
    const prev = i > 0 ? parseISO(periods[i - 1].start) : null
    return unit === 'week'
      ? { label: format(d, 'd'), sublabel: !prev || prev.getMonth() !== d.getMonth() ? format(d, 'MMM') : '' }
      : { label: format(d, 'MMM'), sublabel: !prev || prev.getFullYear() !== d.getFullYear() ? format(d, 'yyyy') : '' }
  })

  const yearTotals = sumWhere(byDate, (d) => d.startsWith(`${year}-`))
  const monthPrefix = format(monthStart, 'yyyy-MM')
  const monthTotals = sumWhere(byDate, (d) => d.startsWith(monthPrefix))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const selectedSessions = (byDate.get(selected)?.sessionIds ?? []).flatMap((id) => sessionById.get(id) ?? [])

  function setTab(next: Tab) {
    const p = new URLSearchParams(params)
    p.set('tab', next)
    setParams(p, { replace: true })
  }

  function selectDate(date: string) {
    const p = new URLSearchParams(params)
    p.set('tab', 'calendar')
    p.set('date', date)
    setParams(p, { replace: true })
    setMonthStart(startOfMonth(parseISO(date)))
    setYear(parseISO(date).getFullYear())
  }

  const [recHobbyId, setRecHobbyId] = useState('')
  const [recSkillId, setRecSkillId] = useState('')
  const [recDescription, setRecDescription] = useState('')

  async function addRecord() {
    if (!recDescription.trim()) return
    await run({
      operation: 'record.create',
      payload: {
        hobbyId: recHobbyId || undefined,
        skillId: recSkillId || undefined,
        date: toISODate(new Date()),
        description: recDescription.trim(),
      },
    })
    setRecDescription('')
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h2>Progress</h2>
        <span className="muted small">
          {qualifying.length} qualifying session{qualifying.length === 1 ? '' : 's'} · {records.length} milestone
          {records.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'calendar' || tab === 'charts') && (
        <div className="row wrap">
          <select aria-label="Show practice for" value={filterKey} onChange={(e) => setFilterKey(e.target.value)}>
            <option value="">All practice</option>
            <optgroup label="Hobby">
              {hobbies
                .filter((h) => !h.archived)
                .map((h) => (
                  <option key={h.id} value={`h:${h.id}`}>
                    {h.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Skill">
              {skills
                .filter((sk) => !sk.archived)
                .map((sk) => (
                  <option key={sk.id} value={`s:${sk.id}`}>
                    {sk.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
      )}

      {tab === 'calendar' && (
        <>
          <Panel
            title={String(year)}
            icon="▦"
            actions={
              <>
                <button type="button" className="icon-btn" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
                  ‹
                </button>
                <button type="button" className="icon-btn" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
                  ›
                </button>
              </>
            }
          >
            <YearHeatmap year={year} byDate={byDate} selected={selected} todayKey={todayKey} onSelect={selectDate} />
            <div className="row row-between wrap mt-sm">
              <span className="desc m0">
                {plural(yearTotals.days, 'active day')} · {formatDuration(yearTotals.sec)} in {year}
              </span>
              <HeatLegend />
            </div>
          </Panel>

          <div className="calendar-split">
            <Panel
              title={format(monthStart, 'MMMM yyyy')}
              icon="▤"
              actions={
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Previous month"
                    onClick={() => setMonthStart((m) => addMonths(m, -1))}
                  >
                    ‹
                  </button>
                  <button type="button" className="icon-btn" onClick={() => selectDate(todayKey)} title="Back to today">
                    today
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Next month"
                    onClick={() => setMonthStart((m) => addMonths(m, 1))}
                  >
                    ›
                  </button>
                </>
              }
            >
              <MonthCalendar
                monthStart={monthStart}
                byDate={byDate}
                selected={selected}
                todayKey={todayKey}
                onSelect={selectDate}
              />
              <p className="desc m0 mt-sm">
                {plural(monthTotals.days, 'active day')} · {formatDuration(monthTotals.sec)} ·{' '}
                {plural(monthTotals.sessions, 'session')}
              </p>
            </Panel>

            <Panel title={format(parseISO(selected), 'EEEE d MMMM')} icon="◷" count={selectedSessions.length}>
              {selectedSessions.length === 0 ? (
                <p className="empty-hint">{selected > todayKey ? 'Still to come.' : 'Nothing logged this day.'}</p>
              ) : (
                <ul className="list-plain">
                  {selectedSessions.map((s) => (
                    <li key={s.id} className="list-row recent-row">
                      <span className="dot dot-success" />
                      <Link to={`/session/${s.id}`} className="grow bar-label">
                        {sessionTitle(s, routines)}
                      </Link>
                      <span className="list-row-meta">
                        {s.durationSec !== undefined ? formatDuration(s.durationSec) : ''}
                      </span>
                      {s.hobbyIds.length + s.skillIds.length > 0 && (
                        <span className="recent-tags">
                          {s.hobbyIds.map((id) => (
                            <Chip key={id} tone="hobby">
                              {hobbyById.get(id)?.name ?? '?'}
                            </Chip>
                          ))}
                          {s.skillIds.map((id) => (
                            <Chip key={id} tone="skill">
                              {skillById.get(id)?.name ?? '?'}
                            </Chip>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      {tab === 'charts' && (
        <>
          <Panel
            title="Time practised"
            icon="▥"
            actions={
              <div className="seg" role="group" aria-label="Group by">
                {(['week', 'month'] as const).map((u) => (
                  <button key={u} type="button" className="seg-btn" aria-pressed={unit === u} onClick={() => setUnit(u)}>
                    {u === 'week' ? 'Weeks' : 'Months'}
                  </button>
                ))}
              </div>
            }
          >
            <div className="stat-row">
              <div>
                <div className="stat-label">This {unit}</div>
                <div className="stat-value">{formatDuration(current.sec)}</div>
              </div>
              <div>
                <div className="stat-label">Average</div>
                <div className="stat-value">{formatDuration(Math.round(periodSum / periods.length))}</div>
              </div>
              <div>
                <div className="stat-label">Last 12 {unit}s</div>
                <div className="stat-value">{formatDuration(periodSum)}</div>
              </div>
            </div>
            <BarChart
              bars={periods.map((p, i) => ({
                key: p.start,
                ...axis[i],
                value: p.sec,
                current: i === periods.length - 1,
                title: `${unit === 'week' ? `Week of ${p.label}` : format(parseISO(p.start), 'MMMM yyyy')} · ${formatDuration(p.sec)} · ${plural(p.activeDays, 'active day')}`,
              }))}
              formatValue={hours}
              onSelect={selectDate}
            />
            <p className="desc m0 mt-sm">Tap a bar to open it in the calendar.</p>
          </Panel>

          <Panel title="Active days" icon="▥" description={`Days with at least one session, per ${unit}.`}>
            <BarChart
              bars={periods.map((p, i) => ({
                key: p.start,
                ...axis[i],
                value: p.activeDays,
                current: i === periods.length - 1,
                title: `${unit === 'week' ? `Week of ${p.label}` : format(parseISO(p.start), 'MMMM yyyy')} · ${plural(p.activeDays, 'active day')} · ${plural(p.sessions, 'session')}`,
              }))}
              formatValue={String}
              onSelect={selectDate}
            />
          </Panel>

          <Panel
            title="Time by skill"
            icon="▤"
            count={skillRows.length}
            description="Time in sessions tagged with each skill — how much you practised, not how skilled you've become."
          >
            {skillRows.length === 0 ? <p className="empty-hint">No skills yet.</p> : <BarRows rows={skillRows} />}
          </Panel>

          <Panel title="Time by hobby" icon="▤" count={hobbyRows.length} description="Time in sessions tagged with each hobby.">
            {hobbyRows.length === 0 ? <p className="empty-hint">No hobbies yet.</p> : <BarRows rows={hobbyRows} />}
          </Panel>

          <Panel
            title="Untouched skills"
            icon="◌"
            count={untouchedSkills.length}
            description="Skills with no finished session yet."
          >
            {untouchedSkills.length === 0 ? (
              <p className="ok-line m0">✓ Every skill has been practiced at least once.</p>
            ) : (
              <div className="row wrap">
                {untouchedSkills.map((r) => (
                  <Chip key={r.id} tone="skill">
                    {r.name}
                  </Chip>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === 'tasks' && (
        <Panel
          title="Task completion"
          icon="✓"
          count={qualifying.length}
          description="Completed vs. planned tasks for every finished session, newest first."
        >
          {qualifying.length === 0 && <p className="empty-hint">No finished sessions yet.</p>}
          <ul className="list-plain">
            {qualifying
              .slice()
              .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
              .map((s) => {
                const completed = s.taskEntries.filter((e) => e.status === 'completed').length
                const total = s.taskEntries.length
                const all = total > 0 && completed === total
                return (
                  <li key={s.id} className="list-row">
                    <span className={all ? 'dot dot-success' : 'dot dot-amber'} />
                    <span className="muted">{s.dateKey}</span>
                    <span className="grow bar-label">{sessionTitle(s, routines)}</span>
                    <span className="bar-count">
                      {completed}/{total}
                    </span>
                  </li>
                )
              })}
          </ul>
        </Panel>
      )}

      {tab === 'records' && (
        <>
          <Panel title="Record a milestone" icon="+">
            <div className="row">
              <select aria-label="Hobby" value={recHobbyId} onChange={(e) => setRecHobbyId(e.target.value)}>
                <option value="">Hobby (optional)…</option>
                {hobbies.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <select aria-label="Skill" value={recSkillId} onChange={(e) => setRecSkillId(e.target.value)}>
                <option value="">Skill (optional)…</option>
                {skills
                  .filter((sk) => !sk.archived)
                  .map((sk) => (
                    <option key={sk.id} value={sk.id}>
                      {sk.name}
                    </option>
                  ))}
              </select>
            </div>
            <EnterForm className="row mt-sm" onSubmit={addRecord}>
              <input
                type="text"
                enterKeyHint="go"
                aria-label="Milestone"
                placeholder="e.g. Implemented a working boss attack"
                value={recDescription}
                onChange={(e) => setRecDescription(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </EnterForm>
          </Panel>

          <Panel title="Milestones" icon="★" count={records.length}>
            {records.length === 0 && <p className="empty-hint">No milestones recorded yet.</p>}
            <ul className="list-plain">
              {records
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((r) => (
                  <li key={r.id} className="list-row">
                    <span className="dot dot-violet" />
                    <span className="muted">{r.date}</span>
                    <span className="grow">
                      <InlineEdit
                        value={r.description}
                        ariaLabel="Milestone"
                        onSave={(description) => run({ operation: 'record.update', payload: { id: r.id, description } })}
                      />
                    </span>
                    {r.hobbyId && hobbyById.get(r.hobbyId) && <Chip tone="hobby">{hobbyById.get(r.hobbyId)!.name}</Chip>}
                    {r.skillId && skillById.get(r.skillId) && <Chip tone="skill">{skillById.get(r.skillId)!.name}</Chip>}
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete milestone ${r.description}`}
                      title="Delete"
                      onClick={() => setDeletingRecordId(r.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          </Panel>
        </>
      )}

      {deletingRecordId && (
        <ConfirmDialog
          title="Delete this milestone?"
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            await run({ operation: 'record.delete', payload: { id: deletingRecordId } })
            setDeletingRecordId(null)
          }}
          onCancel={() => setDeletingRecordId(null)}
        />
      )}
    </div>
  )
}
