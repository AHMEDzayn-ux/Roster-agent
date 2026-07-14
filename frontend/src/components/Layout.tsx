import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function Layout() {
  const { isAuthenticated, role, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="text-lg font-semibold text-slate-900">
              CallRoster Pro
            </NavLink>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={linkClass}>
                Public Roster
              </NavLink>
              {role === 'agent' && (
                <>
                  <NavLink to="/agent" end className={linkClass}>
                    Dashboard
                  </NavLink>
                  <NavLink to="/agent/requests" className={linkClass}>
                    My Requests
                  </NavLink>
                  <NavLink to="/agent/appeals" className={linkClass}>
                    My Appeals
                  </NavLink>
                  <NavLink to="/agent/audit" className={linkClass}>
                    My Audit Trail
                  </NavLink>
                </>
              )}
              {role === 'manager' && (
                <>
                  <NavLink to="/manager" end className={linkClass}>
                    Dashboard
                  </NavLink>
                  <NavLink to="/manager/requests" className={linkClass}>
                    Requests
                  </NavLink>
                  <NavLink to="/manager/roster" className={linkClass}>
                    Roster
                  </NavLink>
                  <NavLink to="/manager/appeals" className={linkClass}>
                    Appeals
                  </NavLink>
                  <NavLink to="/manager/config" className={linkClass}>
                    Config
                  </NavLink>
                  <NavLink to="/manager/audit" className={linkClass}>
                    Audit Log
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div>
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Log out
              </button>
            ) : (
              <NavLink
                to="/login"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Log in
              </NavLink>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
