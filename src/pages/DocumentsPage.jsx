import { Download, FilePlus2, FileText, Folder, FolderPlus, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DocumentDetailDrawer from '../components/DocumentDetailDrawer'
import DocumentFormModal from '../components/DocumentFormModal'
import StatusBadge from '../components/StatusBadge'
import { DOCUMENT_STATUSES, DOCUMENT_TYPE_OPTIONS, NORM_OPTIONS } from '../lib/constants'
import { createDocumentFolder, listDocumentFolders, listDocuments, openDocumentFile } from '../services/documentService'
import { useAuth } from '../context/AuthContext'

const emptyFilters = {
  search: '',
  status: '',
  moduleId: '',
  norm: '',
  requirementId: '',
  documentType: '',
  followUp: '',
  dateFrom: '',
  dateTo: '',
}

function routeFilters(searchParams) {
  return {
    norm: searchParams.get('norm') || '',
    requirementId: searchParams.get('requirement') || '',
  }
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatBytes(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function followUpState(document) {
  if (document.status === 'approved') return { value: 'approved', label: 'Aprobado', tone: 'good', detail: document.approved_at ? formatDate(document.approved_at) : '' }
  if (!document.review_due_at) return { value: 'no-date', label: 'Sin fecha', tone: 'neutral', detail: 'Sin fecha objetivo' }

  const now = new Date()
  const due = new Date(document.review_due_at)
  const days = Math.ceil((due - now) / 86400000)
  if (days < 0) return { value: 'overdue', label: 'Vencido', tone: 'danger', detail: `Venció ${formatDate(document.review_due_at)}` }
  if (days <= 30) return { value: 'upcoming', label: 'Próximo', tone: 'warning', detail: days === 0 ? 'Vence hoy' : `Vence en ${days} día${days === 1 ? '' : 's'}` }
  return { value: 'on-time', label: 'En término', tone: 'good', detail: `Objetivo ${formatDate(document.review_due_at)}` }
}

function matchesFollowUp(document, filter) {
  if (!filter) return true
  const state = followUpState(document)
  if (filter === 'pending') return document.status !== 'approved'
  return state.value === filter
}

export default function DocumentsPage() {
  const { company, modules, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryString = searchParams.toString()
  const [documents, setDocuments] = useState([])
  const [filters, setFilters] = useState(() => ({ ...emptyFilters, ...routeFilters(searchParams) }))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [folders, setFolders] = useState([])
  const [folderCreateOpen, setFolderCreateOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderSubmitting, setFolderSubmitting] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(Boolean(searchParams.get('norm') || searchParams.get('requirement')))
  const deferredSearch = useDeferredValue(filters.search)
  const selectedFolderId = searchParams.get('folder') || ''

  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) => key !== 'search' && Boolean(value)).length,
    [filters],
  )

  const routeContext = useMemo(() => {
    if (!filters.norm) return ''
    const chapter = searchParams.get('chapter')
    if (filters.requirementId && chapter) return `${filters.norm} · Capítulo ${chapter}`
    return filters.norm === 'SGI' ? 'SGI Integrado' : filters.norm
  }, [filters.norm, filters.requirementId, queryString]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleDocuments = useMemo(
    () => documents.filter((document) => matchesFollowUp(document, filters.followUp)),
    [documents, filters.followUp],
  )

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) || null,
    [folders, selectedFolderId],
  )

  const folderTrail = useMemo(() => {
    if (!selectedFolder) return []
    const byId = new Map(folders.map((folder) => [folder.id, folder]))
    const trail = []
    let current = selectedFolder
    while (current) {
      trail.unshift(current)
      current = current.parent_id ? byId.get(current.parent_id) : null
    }
    return trail
  }, [folders, selectedFolder])

  const childFolders = useMemo(() => {
    if (!filters.requirementId) return []
    return folders.filter((folder) => (folder.parent_id || '') === selectedFolderId)
  }, [folders, filters.requirementId, selectedFolderId])

  const folderDocuments = useMemo(() => {
    if (!filters.requirementId) return visibleDocuments
    return visibleDocuments.filter((document) => (document.folder_id || '') === selectedFolderId)
  }, [visibleDocuments, filters.requirementId, selectedFolderId])

  async function load() {
    if (!company?.id) return
    setLoading(true)
    setError('')
    try {
      const [data, nextFolders] = await Promise.all([
        listDocuments({
          companyId: company.id,
          filters: { ...filters, search: deferredSearch },
        }),
        filters.requirementId ? listDocumentFolders(company.id, filters.requirementId) : Promise.resolve([]),
      ])
      setDocuments(filters.requirementId
        ? data.filter((document) => document.requirement_id === filters.requirementId)
        : data)
      setFolders(nextFolders)
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'No se pudieron cargar los documentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const nextRouteFilters = routeFilters(searchParams)
    setFilters((current) => {
      if (current.norm === nextRouteFilters.norm && current.requirementId === nextRouteFilters.requirementId) return current
      return { ...current, ...nextRouteFilters }
    })
    if (nextRouteFilters.norm || nextRouteFilters.requirementId) setFiltersOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, deferredSearch, filters.status, filters.moduleId, filters.norm, filters.requirementId, filters.documentType, filters.dateFrom, filters.dateTo])

  function setFilter(field, value) {
    if (field === 'norm') {
      setSearchParams({})
      setFilters((current) => ({ ...current, norm: value, requirementId: '' }))
      return
    }
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function clearFilters() {
    setSearchParams({})
    setFilters((current) => ({ ...emptyFilters, search: current.search }))
  }

  async function handleOpenFile(document, event) {
    event?.stopPropagation()
    try {
      await openDocumentFile(document.file_path)
    } catch (openError) {
      console.error(openError)
      setError('No se pudo abrir el archivo. Intentá nuevamente.')
    }
  }

  function openFolder(folderId = '') {
    const next = new URLSearchParams(searchParams)
    if (folderId) next.set('folder', folderId)
    else next.delete('folder')
    setSearchParams(next)
  }

  async function handleCreateFolder(event) {
    event.preventDefault()
    if (!folderName.trim() || !filters.requirementId || folderSubmitting) return
    setFolderSubmitting(true)
    setError('')
    try {
      const created = await createDocumentFolder({
        companyId: company.id,
        requirementId: filters.requirementId,
        parentId: selectedFolder?.id || null,
        userId: user.id,
        name: folderName,
      })
      setFolderName('')
      setFolderCreateOpen(false)
      await load()
      openFolder(created.id)
    } catch (folderError) {
      console.error(folderError)
      setError(folderError.message || 'No se pudo crear la carpeta.')
    } finally {
      setFolderSubmitting(false)
    }
  }

  return (
    <section className="page-stack documents-page">
      <header className="page-heading documents-heading">
        <div>
          <p className="eyebrow">GESTIÓN DOCUMENTAL</p>
          <h1>Documentos</h1>
          <p>{routeContext ? `Vista filtrada: ${routeContext}.` : 'Archivos controlados, responsables y estado actual en un único lugar.'}</p>
        </div>
        <div className="documents-heading-actions">
          {filters.requirementId && (
            <button className="secondary-button page-primary-action" onClick={() => setFolderCreateOpen(true)}>
              <FolderPlus size={18} />
              {selectedFolder ? 'Nueva subcarpeta' : 'Nueva carpeta'}
            </button>
          )}
          <button className="primary-button page-primary-action" onClick={() => setCreateOpen(true)}>
            <FilePlus2 size={18} />
            Nuevo documento
          </button>
        </div>
      </header>

      <div className="document-toolbar">
        <label className="search-box">
          <Search size={18} />
          <input
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            placeholder="Buscar por título, descripción o archivo…"
          />
        </label>
        <button className={`filter-button ${activeFilterCount ? 'filter-button-active' : ''}`} onClick={() => setFiltersOpen((open) => !open)}>
          <SlidersHorizontal size={17} />
          Filtros
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
        <button className="icon-button toolbar-refresh" onClick={load} aria-label="Actualizar" title="Actualizar">
          <RefreshCw size={18} />
        </button>
      </div>

      {filtersOpen && (
        <div className="filters-panel">
          <label className="field">
            <span>Estado</span>
            <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
              <option value="">Todos</option>
              {Object.entries(DOCUMENT_STATUSES).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Seguimiento</span>
            <select value={filters.followUp} onChange={(event) => setFilter('followUp', event.target.value)}>
              <option value="">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="overdue">Vencidos</option>
              <option value="upcoming">Próximos 30 días</option>
              <option value="on-time">En término</option>
              <option value="no-date">Sin fecha objetivo</option>
              <option value="approved">Aprobados</option>
            </select>
          </label>
          <label className="field">
            <span>Módulo</span>
            <select value={filters.moduleId} onChange={(event) => setFilter('moduleId', event.target.value)}>
              <option value="">Todos</option>
              {modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Norma</span>
            <select value={filters.norm} onChange={(event) => setFilter('norm', event.target.value)}>
              <option value="">Todas</option>
              {NORM_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Tipo</span>
            <select value={filters.documentType} onChange={(event) => setFilter('documentType', event.target.value)}>
              <option value="">Todos</option>
              {DOCUMENT_TYPE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="field"><span>Desde</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} /></label>
          <label className="field"><span>Hasta</span><input type="date" value={filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} /></label>
          {activeFilterCount > 0 && <button className="clear-filters" onClick={clearFilters}>Limpiar filtros</button>}
        </div>
      )}

      {error && <div className="page-error" role="alert">{error}</div>}

      {filters.requirementId && (
        <div className="document-folder-browser">
          <div className="document-folder-breadcrumbs" aria-label="Ruta de carpetas">
            <button type="button" onClick={() => openFolder('')}>
              <Folder size={16} />
              Cap. {searchParams.get('chapter') || 'ISO'}
            </button>
            {folderTrail.map((folder) => (
              <span key={folder.id}>
                <span aria-hidden="true">/</span>
                <button type="button" onClick={() => openFolder(folder.id)}>{folder.name}</button>
              </span>
            ))}
          </div>
          <span>{selectedFolder ? `Dentro de ${selectedFolder.name}` : 'Organizá este requisito con las subcarpetas que necesites.'}</span>
        </div>
      )}

      <div className="documents-surface">
        <div className="documents-surface-header">
          <div>
            <strong>{loading ? 'Cargando…' : filters.requirementId
              ? `${folderDocuments.length} documento${folderDocuments.length === 1 ? '' : 's'} · ${childFolders.length} carpeta${childFolders.length === 1 ? '' : 's'}`
              : `${folderDocuments.length} documento${folderDocuments.length === 1 ? '' : 's'}`}</strong>
            <span>{selectedFolder ? `Carpeta: ${selectedFolder.name}` : routeContext ? `Mostrando solamente ${routeContext}` : 'Seleccioná un documento para ver seguimiento e historial'}</span>
          </div>
        </div>

        {loading ? (
          <div className="documents-loading"><span className="loader-dot" /><p>Cargando documentación…</p></div>
        ) : folderDocuments.length === 0 && childFolders.length === 0 ? (
          <div className="documents-empty">
            <div className="empty-icon"><FileText size={26} /></div>
            <strong>No hay documentos para mostrar</strong>
            <p>{filters.search || activeFilterCount ? 'No hay resultados para este filtro. Podés cargar documentación o cambiar la selección.' : 'Cargá el primer documento para comenzar.'}</p>
            {!filters.search && activeFilterCount === 0 && <button className="primary-button" onClick={() => setCreateOpen(true)}>Cargar primer documento</button>}
          </div>
        ) : (
          <>
            {childFolders.length > 0 && (
              <div className="document-folder-grid">
                {childFolders.map((folder) => {
                  const documentCount = visibleDocuments.filter((document) => document.folder_id === folder.id).length
                  const subfolderCount = folders.filter((item) => item.parent_id === folder.id).length
                  return (
                    <button key={folder.id} type="button" className="document-folder-card" onClick={() => openFolder(folder.id)}>
                      <span className="document-folder-icon"><Folder size={22} /></span>
                      <span className="document-folder-copy">
                        <strong>{folder.name}</strong>
                        <small>{documentCount} doc{documentCount === 1 ? '' : 's'}{subfolderCount ? ` · ${subfolderCount} subcarpeta${subfolderCount === 1 ? '' : 's'}` : ''}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {folderDocuments.length > 0 ? <div className="documents-table-wrap">
            <table className="documents-table documents-table-with-followup">
              <thead><tr><th>Documento</th><th>Módulo</th><th>Estado</th><th>Seguimiento</th><th>Responsable</th><th>Fecha</th><th aria-label="Acciones" /></tr></thead>
              <tbody>
                {folderDocuments.map((document) => {
                  const followUp = followUpState(document)
                  return (
                    <tr key={document.id} className="document-row-clickable" onClick={() => setSelectedDocumentId(document.id)}>
                      <td><div className="document-cell-main"><div className="document-file-icon"><FileText size={18} /></div><div><strong>{document.title}</strong><span>{document.document_type} · {document.norm || 'General'} · {formatBytes(document.file_size)}</span></div></div></td>
                      <td data-label="Módulo">{document.module?.name || 'General'}</td>
                      <td data-label="Estado"><StatusBadge status={document.status} /></td>
                      <td data-label="Seguimiento"><div className={`followup-badge ${followUp.tone}`}><strong>{followUp.label}</strong><span>{followUp.detail}</span></div></td>
                      <td data-label="Responsable">{document.responsible?.full_name || document.responsible?.email || 'Sin asignar'}</td>
                      <td data-label="Fecha">{formatDate(document.created_at)}</td>
                      <td><button className="icon-button table-action" onClick={(event) => handleOpenFile(document, event)} aria-label={`Abrir ${document.title}`} title="Abrir archivo"><Download size={17} /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div> : (
              <div className="folder-documents-empty">
                <FileText size={22} />
                <span>Esta carpeta todavía no tiene documentos.</span>
              </div>
            )}
          </>
        )}
      </div>

      <DocumentFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
        defaultNorm={filters.norm}
        defaultRequirementId={filters.requirementId}
        defaultFolderId={selectedFolderId}
      />

      {folderCreateOpen && (
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" onClick={() => { setFolderCreateOpen(false); setFolderName('') }} aria-label="Cerrar" />
          <section className="modal-card folder-modal-card" role="dialog" aria-modal="true" aria-labelledby="new-folder-title">
            <header className="modal-header">
              <div>
                <p className="eyebrow">ORGANIZACIÓN ISO</p>
                <h2 id="new-folder-title">{selectedFolder ? 'Nueva subcarpeta' : 'Nueva carpeta'}</h2>
                <p>{selectedFolder ? `Se creará dentro de “${selectedFolder.name}”.` : 'Se creará dentro del requisito ISO actual.'}</p>
              </div>
              <button className="icon-button" onClick={() => { setFolderCreateOpen(false); setFolderName('') }} aria-label="Cerrar formulario"><X size={20} /></button>
            </header>
            <form className="document-form" onSubmit={handleCreateFolder}>
              <label className="field">
                <span>Nombre de la carpeta *</span>
                <input
                  autoFocus
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  maxLength={120}
                  placeholder="Ej. 5.1 Perfiles de puesto"
                  required
                />
              </label>
              <footer className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => { setFolderCreateOpen(false); setFolderName('') }}>Cancelar</button>
                <button className="primary-button" type="submit" disabled={!folderName.trim() || folderSubmitting}>
                  <FolderPlus size={16} />
                  {folderSubmitting ? 'Creando…' : 'Crear carpeta'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
      <DocumentDetailDrawer documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} onChanged={load} />
    </section>
  )
}
