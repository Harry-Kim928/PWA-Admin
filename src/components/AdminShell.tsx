import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminShell() {
  const { signOut, session } = useAuth()
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-sm font-bold tracking-tight">콴다과외 튜터 어드민</div>
            <nav className="flex gap-3 text-sm">
              <NavLink
                to="/devices"
                className={({ isActive }) =>
                  isActive ? 'font-semibold text-gray-900' : 'text-gray-500'
                }
              >
                디바이스
              </NavLink>
              <NavLink
                to="/push"
                className={({ isActive }) =>
                  isActive ? 'font-semibold text-gray-900' : 'text-gray-500'
                }
              >
                푸시 발송
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{session?.user.phone}</span>
            <button onClick={signOut} className="underline underline-offset-2">
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-6">
        <Outlet />
      </main>
    </div>
  )
}
