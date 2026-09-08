import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AccessPendingPage from '../pages/AccessPendingPage'

export default function ProtectedRoute() {
  const { configured, user, membership, loading, workspaceError } = useAuth()

  if (!configured) {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return (
      <div className="screen-loader" role="status">
        <span className="loader-dot" />
        <p>Preparando tu espacio de trabajo…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (workspaceError || !membership) {
    return <AccessPendingPage error={workspaceError} />
  }

  return <Outlet />
}
