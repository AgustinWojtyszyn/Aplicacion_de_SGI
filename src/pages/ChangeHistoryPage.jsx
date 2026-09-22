import { FileText, History, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DOCUMENT_STATUSES } from '../lib/constants'
import { listCompanyChangeHistory } from '../services/documentService'

const ACTION_FILTERS = [
  { value: '', label: 'Todos los movimientos' },
  { value: 'created', label: 'Documentos creados' },
  { value: 'version_created', label: 'Versiones cargadas' },
  { value: 'responsible_changed', label: 'Responsables' },
  { value: 'submitted_for_review', label: 'Envíos a revisión' },
  { value: 'reviewed', label: 'Revisiones' },
  { value: 'rejected', label: 'Cambios solicitados' },
  { value: 'approved', label: 'Aprobaciones' },
  { value: 'status_changed', label: 'Cambios de estado' },
]

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function personLabel(person) {
  return person?.full_name || person?.email || 'Usuario'
}

function statusLabel(value) {
  return DOCUMENT_STATUSES[value]?.label || value || '—'
}

function activityLabel(item) {
  if (item.action === 'created') return 'Creó el documento'
  if (item.action === 'responsible_changed') return 'Cambió el responsable'
  if (item.action === 'metadata_updated') return 'Actualizó los datos'
  if (item.action === 'version_created') return 'Subió la versión ' + (item.details?.version || '')
  if (item.action === 'submitted_for_review') return 'Envió a revisión'
  if (item.action === 'reviewed') return 'Registró la revisión'
  if (item.action === 'rejected') return 'Solicitó cambios'
  if (item.action === 'approved') return 'Aprobó el documento'
  if (item.action === 'status_changed') return 'Cambió el estado de ' + statusLabel(item.from_status) + ' a ' + statusLabel(item.to_status)
  return 'Actualizó el documento'
}

function activityDetail(item) {
  if (item.details?.comment) return item.details.comment
  if (item.action === 'created' && item.details?.title) return 'Alta inicial: ' + item.details.title
  if (item.action === 'version_created' && item.details?.file_name) return item.details.file_name
  return ''
}

export default function ChangeHistoryPage() {
  const navigate = useNavigate()
  const { company } = useAuth()
  const [entries, setEntries] = useState([])
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!company?.id) return
    setLoading(true)
    setError('')
    try {
      const data = await listCompanyChangeHistory(company.id)
      setEntries(data)
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'No se pudo cargar el historial.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [company?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLowerCase()
    return entries.filter((item) => {
      if (action && item.action !== action) return false
      if (!term) return true
      const haystack = [
        item.document?.title,
        item.document?.document_type,
        personLabel(item.actor),
        item.actor?.email,
        activityLabel(item),
        activityDetail(item),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [entries, search, action])

  return (
    <section className="page-stack change-history-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">TRAZABILIDAD · {company?.name || 'EMPRESA'}</p>
          <h1>Historial de cambios</h1>
          <p>Quién hizo cada movimiento, sobre qué documento y en qué momento.</p>
        </div>
        <button className="icon-button" type="button" onClick={load} disabled={loading} title="Actualizar historial">
          <RefreshCw size={18} />
        </button>
      </header>

      <div className="history-toolbar">
        <label className="history-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar documento, persona o movimiento"
          />
        </label>
        <select value={action} onChange={(event) => setAction(event.target.value)} aria-label="Filtrar movimientos">
          {ACTION_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <span className="history-count">{visibleEntries.length} movimiento{visibleEntries.length === 1 ? '' : 's'}</span>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}

      {loading ? (
        <div className="history-loading"><span className="loader-dot" /> Cargando historial…</div>
      ) : visibleEntries.length === 0 ? (
        <div className="empty-state">
          <History size={28} />
          <strong>No hay movimientos para mostrar</strong>
          <p>{entries.length ? 'Probá cambiando los filtros.' : 'Los cambios documentales de esta empresa aparecerán acá.'}</p>
        </div>
      ) : (
        <div className="history-list">
          {visibleEntries.map((item) => (
            <article className="history-item" key={item.id}>
              <div className="history-item-icon"><FileText size={18} /></div>
              <div className="history-item-copy">
                <div className="history-item-heading">
                  <div>
                    <strong>{activityLabel(item)}</strong>
                    <span>{item.document?.title || 'Documento eliminado'}</span>
                  </div>
                  <time>{formatDateTime(item.created_at)}</time>
                </div>
                <div className="history-item-meta">
                  <span><b>{personLabel(item.actor)}</b>{item.actor?.email && item.actor.email !== item.actor?.full_name ? ' · ' + item.actor.email : ''}</span>
                  {item.document?.document_type && <span>{item.document.document_type}</span>}
                  {item.document?.status && <span>Estado actual: {statusLabel(item.document.status)}</span>}
                </div>
                {activityDetail(item) && <p className="history-item-detail">{activityDetail(item)}</p>}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="history-footer">
        <span>Se muestran hasta los últimos 250 movimientos de la empresa activa.</span>
        <button className="secondary-button" type="button" onClick={() => navigate('/documents')}>
          <FileText size={16} /> Ir a documentos
        </button>
      </div>
    </section>
  )
}
