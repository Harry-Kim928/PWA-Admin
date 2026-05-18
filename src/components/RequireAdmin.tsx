import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RequireAdmin() {
  const { session, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">
        로딩 중...
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (!isAdmin) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-base font-semibold text-gray-900">권한이 없습니다</div>
        <div className="text-sm text-gray-500">이 계정은 어드민으로 등록되어 있지 않아요.</div>
      </div>
    )
  }
  return <Outlet />
}
