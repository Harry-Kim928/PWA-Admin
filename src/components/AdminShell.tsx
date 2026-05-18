import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/devices', label: '디바이스' },
  { to: '/push', label: '푸시 알림' },
  { to: '/textbooks', label: '교재 관리' },
] as const

export default function AdminShell() {
  const { signOut, session } = useAuth()

  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-52 shrink-0 bg-gray-900 text-gray-300 flex flex-col">
        <div className="px-5 pt-6 pb-5 flex items-center gap-2">
          <svg viewBox="0 0 100 100" className="w-7 h-7 shrink-0">
            <circle cx="49" cy="49" r="36" fill="#fff" />
            <circle cx="49" cy="49" r="13" fill="#111827" />
            <circle cx="74" cy="74" r="13" fill="#FF6B1A" />
          </svg>
          <div className="text-sm font-bold text-white leading-tight">
            콴다과외 튜터
            <br />
            <span className="text-[10px] font-medium text-gray-400">어드민</span>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${
                  isActive
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-800 text-[11px] text-gray-500 space-y-1">
          <div className="font-mono">{session?.user.phone}</div>
          <button onClick={signOut} className="text-gray-400 hover:text-white">
            로그아웃
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}
