import { Building2, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { inviteCompanyUser } from '../services/userService'
import { createCompanyWorkspace, slugifyCompanyName } from '../services/tenantService'

export default function CompaniesPage() {
  const { companies, company, refreshWorkspace, switchCompany } = useAuth()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!slugTouched) setSlug(slugifyCompanyName(name))
  }, [name, slugTouched])

  async function handleCreate(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')

    const companyName = name.trim()
    const firstAdminName = adminName.trim()
    const firstAdminEmail = adminEmail.trim().toLowerCase()

    try {
      const companyId = await createCompanyWorkspace({ name: companyName, slug })

      try {
        await inviteCompanyUser({
          companyId,
          email: firstAdminEmail,
          fullName: firstAdminName,
          role: 'admin',
        })
        setNotice(`${companyName} quedó creada. Invitamos a ${firstAdminEmail} como primer administrador.`)
      } catch (inviteError) {
        console.error(inviteError)
        setNotice(`${companyName} quedó creada, pero no pudimos invitar al primer administrador. Abrí la empresa y reintentá desde Usuarios.`)
      }

      setName('')
      setSlug('')
      setSlugTouched(false)
      setAdminName('')
      setAdminEmail('')
      await refreshWorkspace()
    } catch (createError) {
      console.error(createError)
      setError(createError.message || 'No se pudo crear la empresa.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="page-stack companies-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN GLOBAL · EP CONSULTORA</p>
          <h1>Empresas</h1>
          <p>Cada empresa funciona como un espacio aislado con sus propios usuarios, documentos y flujo SGI.</p>
        </div>
        <button className="icon-button" onClick={refreshWorkspace} title="Actualizar empresas"><RefreshCw size={18} /></button>
      </header>

      <div className="companies-layout">
        <article className="company-create-card">
          <div className="company-card-heading">
            <span className="company-card-icon"><Plus size={19} /></span>
            <div><span>NUEVO ESPACIO</span><h2>Agregar empresa</h2></div>
          </div>

          <form onSubmit={handleCreate} className="company-create-form">
            <label>
              Nombre de la empresa
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Empresa Andina SA"
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label>
              Identificador de acceso
              <input
                value={slug}
                onChange={(event) => { setSlug(event.target.value.toLowerCase()); setSlugTouched(true) }}
                placeholder="empresa-andina"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
              <small>Se usa en la dirección de ingreso. Solo minúsculas, números y guiones.</small>
            </label>

            <div className="company-card-heading">
              <span className="company-card-icon"><Building2 size={18} /></span>
              <div><span>PRIMER ACCESO</span><h2>Administrador de la empresa</h2></div>
            </div>

            <label>
              Nombre y apellido
              <input
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
                placeholder="Nombre del responsable"
                minLength={2}
                required
              />
            </label>
            <label>
              Correo del administrador
              <input
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="admin@empresa.com"
                required
              />
              <small>Recibirá una invitación para crear su contraseña y administrar únicamente su empresa.</small>
            </label>

            {error && <div className="form-error" role="alert">{error}</div>}
            {notice && <div className="auth-notice" role="status">{notice}</div>}

            <button
              className="primary-button"
              disabled={submitting || !name.trim() || !slug.trim() || !adminName.trim() || !adminEmail.trim()}
              type="submit"
            >
              <Plus size={17} /> {submitting ? 'Creando…' : 'Crear empresa e invitar admin'}
            </button>
          </form>
        </article>

        <article className="company-list-card">
          <header><span>ESPACIOS ACTIVOS</span><h2>{companies.length} empresa{companies.length === 1 ? '' : 's'}</h2></header>
          <div className="admin-company-list">
            {companies.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`admin-company-row ${item.id === company?.id ? 'active' : ''}`}
                onClick={() => item.id !== company?.id && switchCompany(item.id)}
              >
                <span className="admin-company-icon"><Building2 size={18} /></span>
                <span><strong>{item.name}</strong><small>/login/{item.slug}</small></span>
                <span className="company-row-status">{item.id === company?.id ? 'En uso' : 'Abrir'}</span>
              </button>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}
