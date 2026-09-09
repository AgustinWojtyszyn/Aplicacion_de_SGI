import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../context/AuthContext'

export default function SetPasswordPage() {
  const navigate = useNavigate()
  const { configured, user, loading, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!configured) return <Navigate to="/login" replace />

  if (loading) {
    return (
      <div className="screen-loader" role="status">
        <span className="loader-dot" />
        <p>Validando enlace…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <main className="password-screen">
        <section className="password-card password-card-centered">
          <BrandLogo className="password-brand-logo" />
          <div className="password-icon"><KeyRound size={24} /></div>
          <h1>El enlace no es válido</h1>
          <p>Puede haber vencido o ya haber sido utilizado. Solicitá una nueva invitación o recuperación.</p>
          <button className="primary-button" onClick={() => navigate('/login')}>Volver al acceso</button>
        </section>
      </main>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      await updatePassword(password)
      navigate('/dashboard', { replace: true })
    } catch (updateError) {
      console.error(updateError)
      setError(updateError.message || 'No se pudo guardar la nueva contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="password-screen">
      <section className="password-card">
        <BrandLogo className="password-brand-logo" />
        <p className="eyebrow">ACCESO SEGURO</p>
        <h1>Creá tu contraseña</h1>
        <p>Usá una contraseña de al menos 8 caracteres para completar el acceso a IntegraFlow.</p>

        <form className="password-form" onSubmit={handleSubmit}>
          <label>
            Nueva contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <label>
            Repetir contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar y entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
