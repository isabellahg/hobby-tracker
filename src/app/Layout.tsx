import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/', label: 'Home' },
  { to: '/hobbies', label: 'Hobbies & Skills' },
  { to: '/tasks', label: 'Task Library' },
  { to: '/routines', label: 'Routines' },
  { to: '/plan', label: 'Weekly Plan' },
  { to: '/history', label: 'History' },
  { to: '/progress', label: 'Progress' },
  { to: '/data', label: 'Data' },
  { to: '/import', label: 'LLM Import' },
  { to: '/settings', label: 'Settings' },
]

export function Layout() {
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <h1>Hobby Tracker</h1>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
