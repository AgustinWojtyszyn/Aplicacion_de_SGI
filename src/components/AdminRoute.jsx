import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canManageCompanies, canManageUsers } from '../lib/permissions'

export default function AdminRoute({ platformOnly = false }) {
  const { role, isPlatformAdmin } = useAuth()

  const allowed = platformOnly
    ? canManageCompanies({ role, isPlatformAdmin })
    : canManageUsers(role)

  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
