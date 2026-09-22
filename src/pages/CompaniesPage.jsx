import {
  Archive,
  ArrowRight,
  Building2,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  createCompanyWorkspace,
  deleteCompanyWorkspace,
  listManagedCompanies,
  rememberSelectedCompany,
  setCompanyActive,
  slugifyCompanyName,
  updateCompanyWorkspace,
} from '../services/tenantService'

const EMPTY_FORM = { name: '', slug: '' }

export default function CompaniesPage() {
  const navigate = useNavigate()
  const { company, refreshWorkspace, switchCompany } = useAuth()
  const [managedCompanies, setManagedCompanies] = useState([])
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState(null)
  const [editingCompany, setEditingCompany] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [openingCompanyId, setOpeningCompanyId] = useState('')
  const [deletingCompanyId, setDeletingCompanyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadCompanies() {
    setLoading(true)
    setError('')
    try {
      setManagedCompanies(await listManagedCompanies())
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'No se pudieron cargar las empresas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  const activeCount = managedCompanies.filter((item) => item.is_active).length
  const archivedCount = managedCompanies.length - activeCount

  const visibleCompanies = useMemo(() => {
    const term = search.trim().toLowerCase()
    return managedCompanies.filter((item) => {
      const matchesStatus = filter === 'archived' ? !item.is_active : item.is_active
      if (!matchesStatus) return false
      if (!term) return true
      return [item.name, item.slug].some((value) => value?.toLowerCase().includes(term))
    })
  }, [managedCompanies, filter, search])

  function openCreate() {
    setEditingCompany(null)
    setForm(EMPTY_FORM)
    setError('')
    setModalMode('create')
  }

  function openEdit(item) {
    setEditingCompany(item)
    setForm({ name: item.name, slug: item.slug })
    setError('')
    setModalMode('edit')
  }

  function closeModal() {
    if (submitting) return
    setModalMode(null)
    setEditingCompany(null)
    setForm(EMPTY_FORM)
  }

  async function syncCompanies() {
    await Promise.all([loadCompanies(), refreshWorkspace()])
  }

  async function handleCreate(event) {
    event.preventDefault()
    const companyName = form.name.trim()
    const slug = slugifyCompanyName(companyName)

    if (!companyName || !slug) return

    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      await createCompanyWorkspace({ name: companyName, slug })
      await syncCompanies()
      setNotice(`${companyName} quedó creada. Podés abrirla y agregar usuarios cuando quieras.`)
      setModalMode(null)
      setEditingCompany(null)
      setForm(EMPTY_FORM)
    } catch (createError) {
      console.error(createError)
      setError(createError.message || 'No se pudo crear la empresa.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(event) {
    event.preventDefault()
    if (!editingCompany) return

    const name = form.name.trim()
    const slug = form.slug.trim().toLowerCase()
    if (!name || !slug) return

    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      const updated = await updateCompanyWorkspace({
        companyId: editingCompany.id,
        name,
        slug,
      })

      if (company?.id === editingCompany.id && updated) {
        rememberSelectedCompany(updated)
      }

      await syncCompanies()
      setNotice(`${name} quedó actualizada.`)
      setModalMode(null)
      setEditingCompany(null)
      setForm(EMPTY_FORM)
    } catch (editError) {
      console.error(editError)
      setError(editError.message || 'No se pudo actualizar la empresa.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(item) {
    const archiving = item.is_active
    if (archiving && !window.confirm(`¿Archivar "${item.name}"? Dejará de aparecer en el acceso de usuarios hasta que la restaures.`)) return

    setError('')
    setNotice('')

    try {
      await setCompanyActive({ companyId: item.id, isActive: !item.is_active })
      await syncCompanies()
      setNotice(archiving ? `${item.name} quedó archivada.` : `${item.name} volvió a estar activa.`)
    } catch (actionError) {
      console.error(actionError)
      setError(actionError.message || 'No se pudo cambiar el estado de la empresa.')
    }
  }

  async function handleDelete(item) {
    if (item.is_active || item.slug === 'ep-consultora' || deletingCompanyId) return

    const confirmation = window.prompt(
      `Esta acción elimina definitivamente "${item.name}" junto con sus documentos, trabajos, usuarios asignados e historial de la empresa.\n\nEscribí exactamente el nombre de la empresa para confirmar:`,
    )

    if (confirmation !== item.name) return

    setDeletingCompanyId(item.id)
    setError('')
    setNotice('')

    try {
      const result = await deleteCompanyWorkspace(item.id)
      await syncCompanies()
      setNotice(
        result?.cleanupFailed
          ? `${item.name} fue eliminada. Algunos archivos de Storage no pudieron limpiarse automáticamente.`
          : `${item.name} fue eliminada definitivamente.`,
      )
    } catch (deleteError) {
      console.error(deleteError)
      setError(deleteError.message || 'No se pudo eliminar la empresa.')
    } finally {
      setDeletingCompanyId('')
    }
  }

  async function handleOpenCompany(item) {
    if (!item.is_active) return
    setOpeningCompanyId(item.id)
    setError('')

    try {
      if (item.id !== company?.id) await switchCompany(item.id)
      navigate('/dashboard')
    } catch (openError) {
      console.error(openError)
      setError(openError.message || 'No se pudo abrir la empresa.')
    } finally {
      setOpeningCompanyId('')
    }
  }

  const isSystemCompany = editingCompany?.slug === 'ep-consultora'

  return (
    <section className="page-stack companies-page companies-admin-page">
      <header className="page-heading companies-admin-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN GLOBAL</p>
          <h1>Empresas</h1>
          <p>Creá, editá y administrá los espacios de trabajo desde un solo lugar.</p>
        </div>
        <div className="companies-heading-actions">
          <button className="icon-button" type="button" onClick={loadCompanies} title="Actualizar"><RefreshCw size={18} /></button>
          <button className="primary-button companies-new-button" type="button" onClick={openCreate}><Plus size={17} /> Nueva empresa</button>
        </div>
      </header>

      {notice && <div className="auth-notice companies-notice" role="status">{notice}</div>}
      {error && !modalMode && <div className="form-error" role="alert">{error}</div>}

      <div className="companies-admin-toolbar">
        <label className="companies-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar empresa"
          />
        </label>
        <div className="companies-filter-tabs" role="tablist" aria-label="Estado de empresas">
          <button type="button" className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>
            Activas <span>{activeCount}</span>
          </button>
          <button type="button" className={filter === 'archived' ? 'active' : ''} onClick={() => setFilter('archived')}>
            Archivadas <span>{archivedCount}</span>
          </button>
        </div>
      </div>

      <article className="company-directory-card">
        {loading ? (
          <div className="companies-loading"><span className="loader-dot" /> Cargando empresas…</div>
        ) : visibleCompanies.length === 0 ? (
          <div className="companies-empty">
            <Building2 size={28} />
            <strong>{search ? 'No encontramos empresas' : filter === 'active' ? 'No hay empresas activas' : 'No hay empresas archivadas'}</strong>
            <span>{search ? 'Probá con otro nombre.' : filter === 'active' ? 'Creá una empresa para empezar.' : 'Las empresas archivadas aparecerán acá.'}</span>
          </div>
        ) : (
          <div className="company-management-list">
            {visibleCompanies.map((item) => {
              const isCurrent = item.id === company?.id
              const users = Number(item.member_count || 0)
              const documents = Number(item.document_count || 0)

              return (
                <div className={`company-management-row ${isCurrent ? 'current' : ''}`} key={item.id}>
                  <span className="company-management-icon"><Building2 size={19} /></span>

                  <div className="company-management-main">
                    <div className="company-management-title">
                      <strong>{item.name}</strong>
                      {isCurrent && <span className="company-current-pill">En uso</span>}
                      {!item.is_active && <span className="company-archived-pill">Archivada</span>}
                    </div>
                    <span className="company-management-slug">/{item.slug}</span>
                    <div className="company-management-stats">
                      <span><UsersRound size={14} /> {users} usuario{users === 1 ? '' : 's'}</span>
                      <span><FileText size={14} /> {documents} documento{documents === 1 ? '' : 's'}</span>
                    </div>
                  </div>

                  <div className="company-management-actions">
                    {item.is_active && (
                      <button
                        className="company-open-button"
                        type="button"
                        onClick={() => handleOpenCompany(item)}
                        disabled={openingCompanyId === item.id}
                      >
                        {openingCompanyId === item.id ? 'Abriendo…' : 'Abrir'} <ArrowRight size={16} />
                      </button>
                    )}
                    <button className="company-icon-action" type="button" onClick={() => openEdit(item)} title="Editar empresa">
                      <Pencil size={16} />
                    </button>
                    <button
                      className={`company-icon-action ${item.is_active ? 'archive' : 'restore'}`}
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      title={item.is_active ? 'Archivar empresa' : 'Restaurar empresa'}
                      disabled={item.slug === 'ep-consultora' && item.is_active}
                    >
                      {item.is_active ? <Archive size={16} /> : <RotateCcw size={16} />}
                    </button>
                    {!item.is_active && item.slug !== 'ep-consultora' && (
                      <button
                        className="company-icon-action delete"
                        type="button"
                        onClick={() => handleDelete(item)}
                        title="Eliminar definitivamente"
                        disabled={deletingCompanyId === item.id}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </article>

      {modalMode && (
        <div className="company-modal-layer" role="presentation">
          <button className="company-modal-backdrop" type="button" onClick={closeModal} aria-label="Cerrar" />
          <section className="company-modal" role="dialog" aria-modal="true" aria-labelledby="company-modal-title">
            <header>
              <div>
                <span>{modalMode === 'create' ? 'NUEVO ESPACIO' : 'EDITAR EMPRESA'}</span>
                <h2 id="company-modal-title">{modalMode === 'create' ? 'Nueva empresa' : editingCompany?.name}</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeModal}><X size={19} /></button>
            </header>

            <form className="company-simple-form" onSubmit={modalMode === 'create' ? handleCreate : handleEdit}>
              <label>
                Nombre
                <input
                  autoFocus
                  value={form.name}
                  onChange={(event) => {
                    const name = event.target.value
                    setForm((current) => ({
                      ...current,
                      name,
                      slug: modalMode === 'create' ? slugifyCompanyName(name) : current.slug,
                    }))
                  }}
                  placeholder="Ej. Empresa Andina SA"
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>

              {modalMode === 'create' ? (
                <div className="company-generated-slug">
                  Acceso: <strong>/login/{slugifyCompanyName(form.name) || 'empresa'}</strong>
                  <span> · Se crea sin usuarios. Después podés agregarlos desde Usuarios.</span>
                </div>
              ) : (
                <label>
                  Identificador de acceso
                  <input
                    value={form.slug}
                    onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase() }))}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    disabled={isSystemCompany}
                    required
                  />
                  {isSystemCompany && <small>El identificador de la empresa principal está protegido.</small>}
                </label>
              )}

              {error && <div className="form-error" role="alert">{error}</div>}

              <div className="company-modal-actions">
                <button className="secondary-button" type="button" onClick={closeModal} disabled={submitting}>Cancelar</button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={submitting || !form.name.trim() || (modalMode === 'edit' && !form.slug.trim())}
                >
                  {submitting ? 'Guardando…' : modalMode === 'create' ? 'Crear empresa' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
