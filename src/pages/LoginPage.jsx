import { LockKeyhole, ShieldCheck, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { configured, user, loading, signIn, signUp, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const resetMode = mode === 'reset'
  const registerMode = mode === 'register'

  useEffect(() => {
    setError('')
    setNotice('')
  }, [email, password, fullName, mode])

  if (!loading && user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      if (resetMode) {
        await requestPasswordReset(email)
        setNotice('Si el correo está registrado, vas a recibir un enlace para crear una nueva contraseña.')
      } else if (registerMode) {
        const data = await signUp({ fullName, email, password })
        if (!data.session) {
          setNotice('Cuenta creada. Revisá tu correo para confirmar el registro. Luego un administrador deberá habilitar tu acceso.')
        }
      } else {
        await signIn({ email: email.trim(), password })
      }
    } catch (authError) {
      console.error(authError)
      if (resetMode) setError('No pudimos enviar el correo de recuperación. Intentá nuevamente.')
      else if (registerMode) setError(authError.message || 'No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.')
      else setError('No pudimos iniciar sesión. Revisá tu correo y contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  const heading = resetMode
    ? { kicker: 'Recuperación de acceso', title: 'Restablecer contraseña' }
    : registerMode
      ? { kicker: 'Registro público', title: 'Crear cuenta' }
      : { kicker: 'Acceso seguro', title: 'Iniciar sesión' }

  return (
    <main className="login-screen">
      <section className="login-intro">
        <BrandLogo light className="login-brand-logo" />
        <p className="eyebrow">GESTIÓN DOCUMENTAL · SGI · CUMPLIMIENTO</p>
        <h1>Todo tu sistema de gestión, en un solo flujo.</h1>
        <p>
          IntegraFlow centraliza documentos, versiones, responsables, revisiones, aprobaciones, requisitos ISO y alertas en una plataforma segura y trazable.
        </p>
        <div className="login-feature">
          <ShieldCheck size={19} />
          <span>Registro abierto · acceso a la información protegido por permisos</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-heading">
            <div className="mini-icon">{registerMode ? <UserPlus size={20} /> : <LockKeyhole size={20} />}</div>
            <div>
              <span>{heading.kicker}</span>
              <h2>{heading.title}</h2>
            </div>
          </div>

          {!configured ? (
            <div className="config-warning" role="alert">
              <strong>Falta conectar Supabase</strong>
              <p>Configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para habilitar el acceso.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              {registerMode && (
                <label>
                  Nombre y apellido
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Nombre completo"
                    minLength={2}
                    required
                  />
                </label>
              )}

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

              {!resetMode && (
                <label>
                  Contraseña
                  <input
                    type="password"
                    autoComplete={registerMode ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    minLength={registerMode ? 8 : 6}
                    required
                  />
                </label>
              )}

              {error && <div className="form-error" role="alert">{error}</div>}
              {notice && <div className="auth-notice" role="status">{notice}</div>}

              <button className="primary-button login-submit" disabled={submitting} type="submit">
                {submitting
                  ? resetMode ? 'Enviando…' : registerMode ? 'Creando…' : 'Ingresando…'
                  : resetMode ? 'Enviar enlace' : registerMode ? 'Crear cuenta' : 'Ingresar'}
              </button>

              {mode === 'login' ? (
                <>
                  <button type="button" className="login-text-action" onClick={() => setMode('register')}>
                    ¿No tenés cuenta? Registrate
                  </button>
                  <button type="button" className="login-text-action" onClick={() => setMode('reset')}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </>
              ) : (
                <button type="button" className="login-text-action" onClick={() => setMode('login')}>
                  Volver al inicio de sesión
                </button>
              )}
            </form>
          )}

          <p className="login-help">
            El registro es público. El acceso a cada espacio de trabajo requiere habilitación administrativa.
          </p>
        </div>
      </section>
    </main>
  )
}
