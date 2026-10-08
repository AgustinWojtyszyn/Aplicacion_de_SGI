import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AccessPendingPage from '../pages/AccessPendingPage'

export default function ProtectedRoute() {
  const { configured, user, membership, loading, workspaceError, preferredCompany } = useAuth()
  const location = useLocation()

  if (!configured) {
    return <Navigate to="/" replace />
  }

  // Never unmount an already-authorized workspace during a background session refresh.
  // Unmounting here destroys native File objects selected by the document picker.
  if (loading && (!user || !membership)) {
    return (
      <div className="screen-loader" role="status">
        <span className="loader-dot" />
        <p>Preparando tu espacio de trabajo…</p>
      </div>
    )
  }

  if (!user) {
    const requestedSlug = new URLSearchParams(location.search).get('company')
    const companySlug = requestedSlug || preferredCompany?.slug
    const returnTo = `${location.pathname}${location.search}`
    const loginPath = companySlug ? `/login/${encodeURIComponent(companySlug)}?returnTo=${encodeURIComponent(returnTo)}` : `/?returnTo=${encodeURIComponent(returnTo)}`
    return <Navigate to={loginPath} replace />
  }

  if (workspaceError || !membership) {
    return <AccessPendingPage error={workspaceError} />
  }

  return <Outlet />
}
