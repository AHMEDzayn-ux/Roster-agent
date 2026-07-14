import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { UserRole } from '../types'

export default function ProtectedRoute({ role }: { role: UserRole }) {
  const { isAuthenticated, role: currentRole } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (currentRole !== role) return <Navigate to="/" replace />
  return <Outlet />
}
