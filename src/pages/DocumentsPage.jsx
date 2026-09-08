import { Download, FilePlus2, FileText, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import DocumentFormModal from '../components/DocumentFormModal'
import StatusBadge from '../components/StatusBadge'
import { DOCUMENT_STATUSES, DOCUMENT_TYPE_OPTIONS, NORM_OPTIONS } from '../lib/constants'
import { listDocuments, openDocumentFile } from '../services/documentService'
import { useAuth } from '../context/AuthContext'

const emptyFilters = {
  search: '',
  status: '',
  moduleId: '',
  norm: '',
  documentType: '',
  dateFrom: '',
  dateTo: '',
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatBytes(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const { company, modules } = useAuth()
  const [documents, setDocuments] = useState([])
  const [filters, setFilters] = useState(emptyFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const deferredSearch = useDeferredValue(filters.search)

  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) => key !== 'search' && Boolean(value)).length,
    [filters],
  )

  async function load() {
    if (!company?.id) return
    setLoading(true)
    setError('')
    try {
      const data = await listDocuments({
        companyId: company.id,
        filters: { ...filters, search: deferredSearch },
      })
      setDocuments(data)
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'No se pudieron cargar los documentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, deferredSearch, filters.status, filters.moduleId, filters.norm, filters.documentType, filters.dateFrom, filters.dateTo])

  function setFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  async function handleOpenFile(document) {
    try {
      await openDocumentFile(document.file_path)
    } catch (openError) {
      console.error(openError)
      setError('No se pudo abrir el archivo. Intentá nuevamente.')
    }
  }

  return (
    <section className="page-stack documents-page">
      <header className="page-heading documents-heading">
        <div>
          <p className="eyebrow">GESTIÓN DOCUMENTAL</p>
          <h1>Documentos</h1>
          <p>Archivos controlados, responsables y estado actual en un único lugar.</p>
        </div>
        <button className="primary-button page-primary-action" onClick={() => setCreateOpen(true)}>
          <FilePlus2 size={18} />
          Nuevo documento
        </button>
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
          <label className="field">
            <span>Desde</span>
            <input type="date" value={filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input type="date" value={filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} />
          </label>
          {activeFilterCount > 0 && (
            <button className="clear-filters" onClick={() => setFilters((current) => ({ ...emptyFilters, search: current.search }))}>Limpiar filtros</button>
          )}
        </div>
      )}

      {error && <div className="page-error" role="alert">{error}</div>}

      <div className="documents-surface">
        <div className="documents-surface-header">
          <div>
            <strong>{loading ? 'Cargando…' : `${documents.length} documento${documents.length === 1 ? '' : 's'}`}</strong>
            <span>Resultados según los filtros seleccionados</span>
          </div>
        </div>

        {loading ? (
          <div className="documents-loading"><span className="loader-dot" /><p>Cargando documentación…</p></div>
        ) : documents.length === 0 ? (
          <div className="documents-empty">
            <div className="empty-icon"><FileText size={26} /></div>
            <strong>No hay documentos para mostrar</strong>
            <p>{filters.search || activeFilterCount ? 'Probá cambiando los filtros.' : 'Cargá el primer documento de SF Higiene para comenzar.'}</p>
            {!filters.search && activeFilterCount === 0 && <button className="primary-button" onClick={() => setCreateOpen(true)}>Cargar primer documento</button>}
          </div>
        ) : (
          <div className="documents-table-wrap">
            <table className="documents-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Módulo</th>
                  <th>Estado</th>
                  <th>Responsable</th>
                  <th>Fecha</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <div className="document-cell-main">
                        <div className="document-file-icon"><FileText size={18} /></div>
                        <div>
                          <strong>{document.title}</strong>
                          <span>{document.document_type} · {document.norm || 'General'} · {formatBytes(document.file_size)}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Módulo">{document.module?.name || 'General'}</td>
                    <td data-label="Estado"><StatusBadge status={document.status} /></td>
                    <td data-label="Responsable">{document.responsible?.full_name || document.responsible?.email || 'Sin asignar'}</td>
                    <td data-label="Fecha">{formatDate(document.created_at)}</td>
                    <td>
                      <button className="icon-button table-action" onClick={() => handleOpenFile(document)} aria-label={`Abrir ${document.title}`} title="Abrir archivo">
                        <Download size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DocumentFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />
    </section>
  )
}
