import { ArrowLeft, Building2, LockKeyhole, ShieldCheck, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../context/AuthContext'
import { listLoginCompanies, rememberSelectedCompany } from '../services/tenantService'

export default function LoginPage() {
  const { companySlug } = useParams()
  const { configured, user, loading, signIn, signUp, requestPasswordReset } = useAuth()
  const [company, setCompany] = useState(null)
  const [companyLoading, setCompanyLoading] = useState(true)
  const [companyError, setCompanyError] = useState('')
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
    let mounted = true

    async function resolveCompany() {
      if (!configured || !companySlug) {
        setCompanyLoading(false)
        return
      }

      try {
        const companies = await listLoginCompanies()
        const selected = companies.find((item) => item.slug === companySlug)
        if (!selected) throw new Error('company_not_found')
        if (mounted) {
          setCompany(selected)
          rememberSelectedCompany(selected)
        }
      } catch (loadError) {
        console.error(loadError)
        if (mounted) setCompanyError('La empresa seleccionada no está disponible.')
      } finally {
        if (mounted) setCompanyLoading(false)
      }
    }

    resolveCompany()
    return () => { mounted = false }
  }, [companySlug, configured])

  useEffect(() => {
    setError('')
    setNotice('')
  }, [email, password, fullName, mode])

  if (!loading && user) return <Navigate to="/dashboard" replace />
  if (!companySlug) return <Navigate to="/" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    if (!company) {
      setError('Seleccioná una empresa válida antes de continuar.')
      return
    }

    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      if (resetMode) {
        await requestPasswordReset(email)
        setNotice('Si el correo está registrado, vas a recibir un enlace para crear una nueva contraseña.')
      } else if (registerMode) {
        const data = await signUp({ fullName, email, password, company })
        if (!data.session) {
          setNotice(`Cuenta creada para ${company.name}. Revisá tu correo para confirmar el registro. Luego un administrador deberá habilitar tu acceso.`)
        }
      } else {
        await signIn({ email: email.trim(), password, company })
      }
    } catch (authError) {
      console.error(authError)
      if (resetMode) setError('No pudimos enviar el correo de recuperación. Intentá nuevamente.')
      else if (registerMode) setError(authError.message || 'No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.')
      else setError('No pudimos iniciar sesión. Revisá tu correo, contraseña y empresa seleccionada.')
    } finally {
      setSubmitting(false)
    }
  }

  const heading = resetMode
    ? { kicker: 'Recuperación de acceso', title: 'Restablecer contraseña' }
    : registerMode
      ? { kicker: `Registro · ${company?.name || 'Empresa'}`, title: 'Crear cuenta' }
      : { kicker: `Acceso · ${company?.name || 'Empresa'}`, title: 'Iniciar sesión' }

  return (
    <main className="login-screen tenant-login-screen">
      <section className="login-intro">
        <BrandLogo light className="login-brand-logo" />
        <p className="eyebrow">GESTIÓN DOCUMENTAL · SGI · CUMPLIMIENTO</p>
        <h1>{company ? `${company.name}, en un solo flujo.` : 'Todo tu sistema de gestión, en un solo flujo.'}</h1>
        <p>
          EP Consultora centraliza documentos, versiones, responsables, revisiones, aprobaciones, requisitos ISO y alertas en una plataforma segura y trazable.
        </p>
        {company && (
          <div className="selected-tenant-chip">
            <Building2 size={18} />
            <div><span>ESPACIO SELECCIONADO</span><strong>{company.name}</strong></div>
          </div>
        )}
        <div className="login-feature">
          <ShieldCheck size={19} />
          <span>Tu cuenta solo accede a la documentación de la empresa habilitada</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <Link className="tenant-back-link" to="/"><ArrowLeft size={16} /> Cambiar empresa</Link>

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
          ) : companyLoading ? (
            <div className="tenant-company-loading"><span className="loader-dot" /> Preparando empresa…</div>
          ) : companyError ? (
            <div className="form-error" role="alert">
              {companyError} <Link to="/">Volver a empresas</Link>
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
                    ¿No tenés cuenta? Registrate en {company?.name}
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
            El registro queda asociado a {company?.name || 'la empresa seleccionada'} y requiere habilitación administrativa.
          </p>
        </div>
      </section>
    </main>
  )
}
