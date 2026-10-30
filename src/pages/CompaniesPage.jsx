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
import { getCompanyDeletionBlockReason } from '../lib/companyDeletion'
import {
  createCompanyWorkspace,
  findCompanyBySlug,
  deleteCompanyWorkspace,
  listManagedCompanies,
  listPendingCompanyDeletions,
  retryCompanyDeletion,
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
  const [pendingCleanups, setPendingCleanups] = useState([])
  const [cleanupRunning, setCleanupRunning] = useState('')
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState(null)
  const [editingCompany, setEditingCompany] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [openingCompanyId, setOpeningCompanyId] = useState('')
  const [deletingCompanyId, setDeletingCompanyId] = useState('')
  const [companyToDelete, setCompanyToDelete] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadCompanies() {
    setLoading(true)
    setError('')
    try {
      const [companies, jobs] = await Promise.all([
        listManagedCompanies(),
        listPendingCompanyDeletions().catch((cleanupError) => {
          console.warn('No se pudieron consultar las limpiezas pendientes', cleanupError)
          return []
        }),
      ])
      setManagedCompanies(companies)
      setPendingCleanups(jobs)
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
  const newCompanySlug = modalMode === 'create' ? slugifyCompanyName(form.name) : ''
  const existingCompany = findCompanyBySlug(managedCompanies, newCompanySlug)

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

    if (!companyName || !slug || submitting) return

    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      // Actualizamos el listado antes del alta para detectar empresas archivadas.
      const currentCompanies = await listManagedCompanies()
      setManagedCompanies(currentCompanies)
      if (findCompanyBySlug(currentCompanies, slug)) return

      await createCompanyWorkspace({ name: companyName, slug })
      await syncCompanies()
      setNotice(`${companyName} quedó creada. Podés abrirla y agregar usuarios cuando quieras.`)
      setModalMode(null)
      setEditingCompany(null)
      setForm(EMPTY_FORM)
    } catch (createError) {
      console.error(createError)
      if (createError.message?.includes('Ya existe una empresa con ese identificador')) {
        try {
          const currentCompanies = await listManagedCompanies()
          setManagedCompanies(currentCompanies)
          if (findCompanyBySlug(currentCompanies, slug)) return
        } catch (refreshError) {
          console.error(refreshError)
        }
      }
      setError(createError.message || 'No se pudo crear la empresa.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRestoreCompany() {
    if (!existingCompany || existingCompany.is_active || submitting) return

    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      await setCompanyActive({ companyId: existingCompany.id, isActive: true })
      await syncCompanies()
      setFilter('active')
      setNotice(`${existingCompany.name} quedó restaurada y ya podés abrirla.`)
      setModalMode(null)
      setForm(EMPTY_FORM)
    } catch (restoreError) {
      console.error(restoreError)
      setError(restoreError.message || 'No se pudo restaurar la empresa.')
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


  function openDelete(item) {
    setCompanyToDelete(item)
    setDeleteConfirmation('')
    setError('')
    setNotice('')
  }

  function closeDelete() {
    if (deletingCompanyId) return
    setCompanyToDelete(null)
    setDeleteConfirmation('')
  }

  async function handleDelete(event) {
    event.preventDefault()
    const item = companyToDelete
    if (!item || deletingCompanyId || getCompanyDeletionBlockReason(item)) return
    if (deleteConfirmation !== item.name) return

    setDeletingCompanyId(item.id)
    setError('')
    setNotice('')

    try {
      const result = await deleteCompanyWorkspace(item.id, item.name)
      setCompanyToDelete(null)
      setDeleteConfirmation('')
      await syncCompanies()
      setNotice(result.completed
        ? item.name + ' fue eliminada definitivamente, incluidos sus archivos.'
        : item.name + ' fue eliminada de la base. La limpieza de archivos quedó pendiente; podés completarla desde el aviso de abajo.')
    } catch (deleteError) {
      console.error(deleteError)
      setError(deleteError.message || 'No se pudo eliminar la empresa.')
    } finally {
      setDeletingCompanyId('')
    }
  }

  async function handleRetryCleanup(job) {
    if (cleanupRunning) return
    setCleanupRunning(job.id)
    setError('')
    setNotice('')
    try {
      const result = await retryCompanyDeletion(job.id)
      await syncCompanies()
      setNotice(result.completed
        ? 'Se completó la eliminación de archivos de ' + job.company_name + '.'
        : 'La limpieza de ' + job.company_name + ' todavía tiene archivos pendientes. Podés reintentar.')
    } catch (cleanupError) {
      console.error(cleanupError)
      setError(cleanupError.message || 'No se pudo reanudar la limpieza.')
    } finally {
      setCleanupRunning('')
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

      {pendingCleanups.length > 0 && (
        <div className="company-cleanup-panel" role="status">
          <strong>Eliminaciones con archivos pendientes</strong>
          <p>Estas empresas ya se quitaron del directorio, pero falta terminar de borrar algunos archivos físicos. El proceso se puede reintentar sin eliminar datos de otras empresas.</p>
          {pendingCleanups.map((job) => (
            <div className="company-cleanup-row" key={job.id}>
              <span>{job.company_name}</span>
              <button className="secondary-button" type="button" disabled={Boolean(cleanupRunning)} onClick={() => handleRetryCleanup(job)}>
                <RefreshCw size={15} /> {cleanupRunning === job.id ? 'Limpiando…' : 'Completar limpieza'}
              </button>
            </div>
          ))}
        </div>
      )}

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
                    {item.slug !== 'ep-consultora' && (
                      <button
                        className="company-icon-action delete"
                        type="button"
                        onClick={() => openDelete(item)}
                        title="Revisar eliminación de empresa"
                        aria-label={item.name + " - revisar eliminación"}
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
                    setError('')
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

              {modalMode === 'create' && existingCompany && (
                <div className="company-slug-conflict" role="status">
                  {existingCompany.is_active ? (
                    <p>Este acceso ya pertenece a <strong>{existingCompany.name}</strong>. La empresa está activa; podés encontrarla en la lista de empresas.</p>
                  ) : (
                    <>
                      <p><strong>{existingCompany.name}</strong> está archivada, no eliminada. Su acceso sigue reservado. Podés restaurarla con los datos que ya tenía.</p>
                      <button className="secondary-button" type="button" onClick={handleRestoreCompany} disabled={submitting}>
                        <RotateCcw size={16} /> Restaurar empresa archivada
                      </button>
                    </>
                  )}
                </div>
              )}

              {error && <div className="form-error" role="alert">{error}</div>}

              <div className="company-modal-actions">
                <button className="secondary-button" type="button" onClick={closeModal} disabled={submitting}>Cancelar</button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={submitting || !form.name.trim() || (modalMode === 'create' && Boolean(existingCompany)) || (modalMode === 'edit' && !form.slug.trim())}
                >
                  {submitting ? 'Guardando…' : modalMode === 'create' ? 'Crear empresa' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {companyToDelete && (
        <div className="company-modal-layer" role="presentation">
          <button className="company-modal-backdrop" type="button" onClick={closeDelete} aria-label="Cerrar" />
          <section className="company-modal" role="dialog" aria-modal="true" aria-labelledby="company-delete-title">
            <header>
              <div>
                <span>ADMINISTRACIÓN DE EMPRESAS</span>
                <h2 id="company-delete-title">Eliminar {companyToDelete.name}</h2>
              </div>
              <button className="icon-button" type="button" onClick={closeDelete} disabled={Boolean(deletingCompanyId)} aria-label="Cerrar"><X size={19} /></button>
            </header>
            <form className="company-simple-form" onSubmit={handleDelete}>
              {getCompanyDeletionBlockReason(companyToDelete) ? (
                <p className="company-delete-blocked" role="status">{getCompanyDeletionBlockReason(companyToDelete)}</p>
              ) : (
                <>
                  <div className="company-delete-explanation">
                    <strong>Esta eliminación es permanente.</strong>
                    <p>Se quitarán el espacio, sus {Number(companyToDelete.document_count || 0)} documentos, carpetas, versiones, registros de trabajo y asociaciones de {Number(companyToDelete.member_count || 0)} usuarios. También se eliminarán sus archivos físicos. Las cuentas de usuario y sus accesos a otras empresas se conservan.</p>
                    <p>No hace falta archivar primero. Una vez eliminada, podrás volver a crear una empresa con el mismo nombre.</p>
                  </div>
                  <label>
                    Para confirmar, escribí exactamente <strong>{companyToDelete.name}</strong>
                    <input
                      autoFocus
                      autoComplete="off"
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      placeholder="Nombre completo de la empresa"
                      disabled={Boolean(deletingCompanyId)}
                      required
                    />
                  </label>
                </>
              )}
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="company-modal-actions">
                <button className="secondary-button" type="button" onClick={closeDelete} disabled={Boolean(deletingCompanyId)}>
                  {getCompanyDeletionBlockReason(companyToDelete) ? 'Entendido' : 'Cancelar'}
                </button>
                {!getCompanyDeletionBlockReason(companyToDelete) && (
                  <button className="primary-button company-delete-danger" type="submit" disabled={Boolean(deletingCompanyId) || deleteConfirmation !== companyToDelete.name}>
                    {deletingCompanyId ? 'Eliminando…' : 'Eliminar definitivamente'}
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
