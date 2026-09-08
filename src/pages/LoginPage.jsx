import { FileCheck2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { configured, user, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => setError(''), [email, password])

  // ProtectedRoute decides whether the authenticated user has company access.
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await signIn({ email: email.trim(), password })
    } catch (authError) {
      console.error(authError)
      setError('No pudimos iniciar sesión. Revisá tu correo y contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-screen">
      <section className="login-intro">
        <div className="login-brand-mark">
          <FileCheck2 size={28} />
        </div>
        <p className="eyebrow">SF HIGIENE · SGI</p>
        <h1>Documentación bajo control.</h1>
        <p>
          Un único espacio para organizar documentos, responsables y estados de gestión con una base segura y trazable.
        </p>
        <div className="login-feature">
          <ShieldCheck size={19} />
          <span>Acceso privado · Gestión documental interna</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-heading">
            <div className="mini-icon"><LockKeyhole size={20} /></div>
            <div>
              <span>Acceso al sistema</span>
              <h2>Iniciar sesión</h2>
            </div>
          </div>

          {!configured ? (
            <div className="config-warning" role="alert">
              <strong>Falta conectar Supabase</strong>
              <p>Configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para habilitar el acceso.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <label>
                Correo electrónico
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@empresa.com"
                  required
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </label>

              {error && <div className="form-error" role="alert">{error}</div>}

              <button className="primary-button login-submit" disabled={submitting} type="submit">
                {submitting ? 'Ingresando…' : 'Ingresar'}
              </button>
            </form>
          )}

          <p className="login-help">El acceso es administrado por SF Higiene. No hay registro público.</p>
        </div>
      </section>
    </main>
  )
}
