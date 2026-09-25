import { ArrowRight, Building2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import LandingPreview from '../components/LandingPreview'
import '../styles/landing.css'
import { useAuth } from '../context/AuthContext'
import { listLoginCompanies, rememberSelectedCompany } from '../services/tenantService'

export default function CompanyGatePage() {
  const { configured, user, loading } = useAuth()
  const [companies, setCompanies] = useState([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadCompanies() {
      if (!configured) {
        setLoadingCompanies(false)
        return
      }

      try {
        const data = await listLoginCompanies()
        if (mounted) setCompanies(data)
      } catch (loadError) {
        console.error(loadError)
        if (mounted) setError('No pudimos cargar las empresas habilitadas.')
      } finally {
        if (mounted) setLoadingCompanies(false)
      }
    }

    loadCompanies()
    return () => { mounted = false }
  }, [configured])

  if (!loading && user) return <Navigate to="/dashboard" replace />

  return (
    <div className="sgi-landing" id="inicio">
      <a className="landing-skip" href="#acceso">Ir al acceso por empresa</a>
      <header className="landing-header">
        <div className="landing-container landing-nav">
          <a href="#inicio" aria-label="gestiQa, inicio"><BrandLogo light /></a>
          <nav aria-label="Navegación principal">
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
              <h2 id="access-title">Elegí tu espacio<br />de trabajo.</h2>
              <p>Seleccioná la organización a la que pertenecés para iniciar sesión.</p>
              <div className="landing-security"><ShieldCheck size={22} aria-hidden="true" /><p><strong>Un entorno independiente</strong><span>Documentación aislada por empresa y acceso protegido por permisos.</span></p></div>
            </div>
            <div className="landing-company-panel">
              <header className="landing-company-heading"><h3>¿A qué empresa querés ingresar?</h3><span>Seleccioná para continuar</span></header>
              {!configured ? (
                <div className="config-warning" role="alert">
                  <strong>El acceso todavía no está disponible</strong>
                  <p>Consultá con el administrador de EP Consultora para habilitar el sistema.</p>
                </div>
              ) : error ? (
                <div className="form-error" role="alert">{error}</div>
              ) : loadingCompanies ? (
                <div className="landing-company-loading" role="status"><span className="loader-dot" /> Cargando empresas…</div>
              ) : companies.length === 0 ? (
                <div className="landing-empty-state">
                  <Building2 size={24} />
                  <strong>No hay empresas habilitadas</strong>
                  <span>El administrador global debe crear el primer espacio de trabajo desde EP Consultora.</span>
                </div>
              ) : (
                <div className="landing-company-list">
                  {companies.map((company) => (
                    <Link
                      key={company.id}
                      to={`/login/${company.slug}`}
                      className="landing-company-option"
                      onClick={() => rememberSelectedCompany(company)}
                    >
                      <span className="landing-company-icon"><Building2 size={20} aria-hidden="true" /></span>
                      <span className="landing-company-copy">
                        <strong>{company.name}</strong>
                        <small>Ingresar al espacio documental</small>
                      </span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}

              <p className="landing-access-help">
                Si tu empresa no aparece, consultá con el administrador de EP Consultora.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-container landing-footer"><span>EP Consultora</span><span>Sistema de Gestión Integrado</span><a href="#inicio">Volver al inicio ↑</a></footer>
    </div>
  )
}
