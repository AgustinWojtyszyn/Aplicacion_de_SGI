import { displayCompanyName } from '../lib/branding'
import { ArrowRight, Building2, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import LandingPreview from '../components/LandingPreview'
import '../styles/landing.css'
import { useAuth } from '../context/AuthContext'
import { readSelectedCompany } from '../services/tenantService'

const LANDING_THEME_KEY = 'gestiqa.landing-theme'

function initialLandingTheme() {
  try {
    const savedTheme = window.localStorage.getItem(LANDING_THEME_KEY)
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  } catch {
    // The system preference still works when browser storage is unavailable.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function CompanyGatePage() {
  const [theme, setTheme] = useState(initialLandingTheme)

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    try {
      window.localStorage.setItem(LANDING_THEME_KEY, nextTheme)
    } catch {
      // Keep the control usable even if this browser cannot persist preferences.
    }
  }

  const { configured, user, loading } = useAuth()
  const navigate = useNavigate()
  const [companyCode, setCompanyCode] = useState('')
  const [error, setError] = useState('')
  const savedCompany = readSelectedCompany()

  function handleCompanyAccess(event) {
    event.preventDefault()
    const slug = companyCode.trim().toLowerCase()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError('Ingresá el código de empresa que te proporcionó tu administrador (letras, números y guiones).')
      return
    }
    setError('')
    navigate(`/login/${encodeURIComponent(slug)}`)
  }

  if (!loading && user) return <Navigate to="/dashboard" replace />

  return (
    <div className="sgi-landing" data-theme={theme} id="inicio">
      <a className="landing-skip" href="#acceso">Ir al acceso seguro</a>
      <header className="landing-header">
        <div className="landing-container landing-nav">
          <a href="#inicio" aria-label="EP GESTIÓN, inicio"><BrandLogo light={theme === 'dark'} /></a>
          <nav aria-label="Navegación principal">
            <button
              type="button"
              className="landing-theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            >
              {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            </button>
            <a className="landing-button landing-button-small" href="#acceso">Ingresar <ArrowRight size={16} aria-hidden="true" /></a>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-container landing-hero" id="plataforma" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><span /> SISTEMA DE GESTIÓN INTEGRADO</p>
            <h1 id="landing-title">Tu gestión documental.<br /><em>Todo en su lugar.</em></h1>
            <p className="landing-description">Documentos, revisiones y cumplimiento en un mismo espacio. Una visión clara del SGI para acompañar el trabajo de tu empresa.</p>
            <a className="landing-button" href="#acceso">Ingresar a mi empresa <ArrowRight size={18} aria-hidden="true" /></a>
            <p className="landing-hero-note">Tu organización. Tu espacio de trabajo.</p>
          </div>
          <LandingPreview />
        </section>

        <div className="landing-container landing-standards" aria-label="Normas del sistema">
          <span>Una plataforma para tu gestión integrada</span>
          <ul><li>ISO 9001</li><li>ISO 14001</li><li>ISO 45001</li></ul>
        </div>

        <section className="landing-access" id="acceso" aria-labelledby="access-title" tabIndex={-1}>
          <div className="landing-container landing-access-layout">
            <div className="landing-access-intro">
              <p className="landing-eyebrow">ACCESO POR EMPRESA</p>
              <h2 id="access-title">Ingresá a tu espacio<br />de trabajo.</h2>
              <p>Usá el código o el enlace de acceso que te proporcionó tu empresa. No mostramos listados de otras organizaciones.</p>
              <div className="landing-security"><ShieldCheck size={22} aria-hidden="true" /><p><strong>Un entorno independiente</strong><span>Documentación aislada por empresa y acceso protegido por permisos.</span></p></div>
            </div>
            <div className="landing-company-panel">
              <header className="landing-company-heading"><h3>Acceso privado por empresa</h3><span>Ingresá el identificador de tu organización para continuar</span></header>
              {!configured ? (
                <div className="config-warning" role="alert">
                  <strong>El acceso todavía no está disponible</strong>
                  <p>Consultá con el administrador de EP GESTIÓN para habilitar el sistema.</p>
                </div>
              ) : (
                <>
                  <form className="landing-code-form" onSubmit={handleCompanyAccess}>
                    <label htmlFor="company-access-code">Código de empresa</label>
                    <div className="landing-code-field">
                      <Building2 size={20} aria-hidden="true" />
                      <input
                        id="company-access-code"
                        spellCheck={false}
                        value={companyCode}
                        onChange={(event) => { setCompanyCode(event.target.value); if (error) setError('') }}
                        placeholder="ejemplo-mi-empresa"
                        required
                      />
                    </div>
                    {error && <div className="form-error" role="alert">{error}</div>}
                    <button className="landing-button" type="submit">Continuar <ArrowRight size={18} aria-hidden="true" /></button>
                  </form>
                  {savedCompany?.slug && (
                    <Link to={`/login/${encodeURIComponent(savedCompany.slug)}`} className="landing-last-company">
                      <span className="landing-company-icon"><Building2 size={20} aria-hidden="true" /></span>
                      <span className="landing-company-copy"><strong>Volver a {displayCompanyName(savedCompany, 'mi empresa')}</strong><small>Último espacio utilizado en este dispositivo</small></span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  )}
                </>
              )}

              <p className="landing-access-help">
                Si no conocés el código de tu empresa, pedíselo a su administrador.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-container landing-footer"><span>EP GESTIÓN</span><span>Sistemas de Gestión Integrados</span><a href="#inicio">Volver al inicio ↑</a></footer>
    </div>
  )
}
