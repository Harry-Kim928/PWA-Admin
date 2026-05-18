import { Navigate, Route, Routes } from 'react-router-dom'
import AdminShell from './components/AdminShell'
import RequireAdmin from './components/RequireAdmin'
import DevicesPage from './pages/DevicesPage'
import LoginPage from './pages/LoginPage'
import PushPage from './pages/PushPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAdmin />}>
        <Route element={<AdminShell />}>
          <Route path="/" element={<Navigate to="/devices" replace />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/push" element={<PushPage />} />
          <Route path="*" element={<Navigate to="/devices" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
