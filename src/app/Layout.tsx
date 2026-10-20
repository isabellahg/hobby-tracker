import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAppStore } from '../state/store'
import { computeWeekStreak } from '../domain/logic/weekStreak'
import { Toaster } from '../components/Toaster'
import type { ItemList } from '../domain/types/list'

interface NavItem {
  to: string
  label: string
}

/** Grouped like folders in a file tree. */
const NAV_GROUPS: { name: string; items: NavItem[] }[] = [
  {
    name: 'plan',
    items: [
      { to: '/', label: 'Home' },
      { to: '/routines', label: 'Routines' },
      { to: '/plan', label: 'Weekly Plan' },
    ],
  },
  {
    name: 'library',
    items: [
      { to: '/hobbies', label: 'Hobbies & Skills' },
      { to: '/tasks', label: 'Task Library' },
    ],
  },
  {
    name: 'review',
    items: [
      { to: '/history', label: 'History' },
      { to: '/progress', label: 'Progress' },
    ],
  },
  {
    name: 'system',
    items: [
      { to: '/sync', label: 'Sync' },
      { to: '/data', label: 'Data' },
      { to: '/import', label: 'LLM Import' },
      { to: '/settings', label: 'Settings' },
    ],
  },
]

/** Habits, then your own lists by name. Lists are made and renamed in Settings. */
function listsGroup(lists: ItemList[]): { name: string; items: NavItem[] } {
  const open = lists.filter((l) => !l.archived).sort((a, b) => a.order - b.order)
  return {
    name: 'lists',
    items: [{ to: '/habits', label: 'Habits' }, ...open.map((l) => ({ to: `/lists/${l.id}`, label: l.name }))],
  }
}

function breadcrumb(pathname: string, lists: ItemList[]): string[] {
  if (pathname.startsWith('/session/')) return ['session', 'Session']
  if (pathname === '/habits') return ['lists', 'Habits']
  if (pathname.startsWith('/lists/')) {
    const list = lists.find((l) => `/lists/${l.id}` === pathname)
    return ['lists', list?.name ?? 'List']
  }
  if (pathname.startsWith('/routines/')) return ['plan', 'Routines', pathname.endsWith('/new') ? 'New' : 'Edit']
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => i.to === pathname)
    if (item) return [group.name, item.label]
  }
  return []
}

function StatusBar() {
  const sessions = useAppStore((s) => s.sessions)
  const taskDefs = useAppStore((s) => s.taskDefs)
  const [now] = useState(() => new Date())
  const streak = useMemo(() => computeWeekStreak(sessions, now), [sessions, now])
  const running = sessions.find((s) => s.state === 'in_progress')
  const openTasks = taskDefs.filter((t) => !t.archived).length
  const finished = sessions.filter((s) => s.state === 'finished').length

  return (
    <footer className="status-bar">
      {running && (
        <Link to={`/session/${running.id}`} className="row">
          <span className="dot dot-violet" /> session running
        </Link>
      )}
      <span>streak {streak.currentStreak} wk</span>
      <span>best {streak.longestStreak} wk</span>
      <span>{streak.weekActiveDays}/7 active this week</span>
      <span>{openTasks} open tasks</span>
      <span>{finished} sessions</span>
      <span>local-only</span>
    </footer>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const lists = useAppStore((s) => s.lists)
  const crumbs = breadcrumb(pathname, lists)
  const groups = [NAV_GROUPS[0], listsGroup(lists), ...NAV_GROUPS.slice(1)]
  // Only matters on narrow screens, where the nav is a slide-out drawer.
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="app-shell">
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
      <nav
        className={navOpen ? 'app-nav is-open' : 'app-nav'}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) setNavOpen(false)
        }}
      >
        <p className="app-nav-title">Hobby Tracker</p>
        {groups.map((group) => (
          <details key={group.name} className="nav-group" open>
            <summary>{group.name}</summary>
            {group.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                {item.label}
              </NavLink>
            ))}
          </details>
        ))}
      </nav>
      <div className="app-content">
        <div className="app-topbar">
          <button
            type="button"
            className="icon-btn nav-toggle"
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((o) => !o)}
          >
            ☰
          </button>
          <span className="crumb-root">Hobby Tracker</span>
          {crumbs.map((c, i) => (
            <span key={c} className={i === crumbs.length - 1 ? 'crumb-current' : undefined}>
              / {c}
            </span>
          ))}
        </div>
        {/* On wide screens Home's columns scroll on their own instead of the whole page. */}
        <main className={pathname === '/' ? 'app-main app-main-columns' : 'app-main'}>
          <div className="app-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
      <StatusBar />
      <Toaster />
    </div>
  )
}
