import { ArrowRight, Building2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
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
    <main className="tenant-gate-screen">
      <section className="tenant-gate-hero">
        <BrandLogo light className="tenant-gate-logo" />
        <div>
          <p className="eyebrow">ACCESO POR EMPRESA</p>
          <h1>Elegí tu espacio de trabajo.</h1>
          <p>
            Cada empresa tiene un entorno independiente. Seleccioná la organización a la que pertenecés antes de iniciar sesión.
          </p>
        </div>
        <div className="tenant-security-note">
          <ShieldCheck size={19} />
          <span>La documentación permanece aislada por empresa y protegida por permisos.</span>
        </div>
      </section>

      <section className="tenant-gate-panel">
        <div className="tenant-gate-card">
          <header>
            <span>EP Consultora</span>
            <h2>¿A qué empresa querés ingresar?</h2>
            <p>Tu selección define el espacio que se abrirá después de autenticarte.</p>
          </header>

          {!configured ? (
            <div className="config-warning" role="alert">
              <strong>Falta conectar Supabase</strong>
              <p>Configurá las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.</p>
            </div>
          ) : error ? (
            <div className="form-error" role="alert">{error}</div>
          ) : loadingCompanies ? (
            <div className="tenant-company-loading"><span className="loader-dot" /> Cargando empresas…</div>
          ) : companies.length === 0 ? (
            <div className="tenant-empty-state">
              <Building2 size={24} />
              <strong>No hay empresas habilitadas</strong>
              <span>El administrador global debe crear el primer espacio de trabajo desde EP Consultora.</span>
            </div>
          ) : (
            <div className="tenant-company-list">
              {companies.map((company) => (
                <Link
                  key={company.id}
                  to={`/login/${company.slug}`}
                  className="tenant-company-option"
                  onClick={() => rememberSelectedCompany(company)}
                >
                  <span className="tenant-company-icon"><Building2 size={20} /></span>
                  <span className="tenant-company-copy">
                    <strong>{company.name}</strong>
                    <small>Ingresar al espacio documental</small>
                  </span>
                  <ArrowRight size={18} />
                </Link>
              ))}
            </div>
          )}

          <p className="tenant-gate-help">
            Si tu empresa no aparece, consultá con el administrador de EP Consultora.
          </p>
        </div>
      </section>
    </main>
  )
}
