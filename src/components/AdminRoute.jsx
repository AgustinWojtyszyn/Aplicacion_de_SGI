import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canManageUsers } from '../lib/permissions'

export default function AdminRoute() {
  const { role } = useAuth()

  if (!canManageUsers(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
