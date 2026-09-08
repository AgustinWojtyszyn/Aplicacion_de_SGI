import { ArrowRight, CheckCircle2, Clock3, FileText, FolderOpen, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DocumentDetailDrawer from '../components/DocumentDetailDrawer'
import StatusBadge from '../components/StatusBadge'
import { DOCUMENT_STATUSES } from '../lib/constants'
import { listDocuments } from '../services/documentService'
import { useAuth } from '../context/AuthContext'

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(value))
}

function firstName(profile) {
  const value = profile?.full_name?.trim()
  if (value) return value.split(/\s+/)[0]
  return 'bienvenido'
}

export default function DashboardPage() {
  const { company, profile, user, modules } = useAuth()
  const [documents, setDocuments] = useState([])
  const [selectedDocumentId, setSelectedDocumentId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!company?.id) return
    setLoading(true)
    setError('')
    try {
      setDocuments(await listDocuments({ companyId: company.id }))
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'No se pudo cargar el resumen.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id])

  const stats = useMemo(() => {
    const total = documents.length
    const draft = documents.filter((item) => item.status === 'draft').length
    const inProgress = documents.filter((item) => item.status === 'in_progress').length
    const approved = documents.filter((item) => item.status === 'approved').length
    const mine = documents.filter((item) => item.responsible?.id === user?.id && item.status !== 'approved').length
    return { total, draft, inProgress, approved, mine }
  }, [documents, user?.id])

  const recentDocuments = documents.slice(0, 6)
  const pendingDocuments = documents
    .filter((item) => item.status !== 'approved')
    .sort((a, b) => {
      const aMine = a.responsible?.id === user?.id ? 1 : 0
      const bMine = b.responsible?.id === user?.id ? 1 : 0
      if (aMine !== bMine) return bMine - aMine
      return new Date(b.updated_at) - new Date(a.updated_at)
    })
    .slice(0, 5)

  const approvedPercent = stats.total ? Math.round((stats.approved / stats.total) * 100) : 0

  return (
    <section className="page-stack dashboard-page">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">RESUMEN OPERATIVO</p>
          <h1>Hola, {firstName(profile)}.</h1>
          <p>Este es el estado actual de la documentación de {company?.name || 'SF Higiene'}.</p>
        </div>
        <div className="dashboard-actions">
          <button className="icon-button dashboard-refresh" onClick={load} aria-label="Actualizar resumen" title="Actualizar"><RefreshCw size={18} /></button>
          <Link className="primary-button dashboard-new-link" to="/documents"><Plus size={17} /> Gestionar documentos</Link>
        </div>
      </header>

      {error && <div className="page-error" role="alert">{error}</div>}

      <div className="stats-grid">
        <article className="stat-card stat-total"><div className="stat-icon"><FolderOpen size={20} /></div><div><span>Total documental</span><strong>{loading ? '—' : stats.total}</strong><small>archivos registrados</small></div></article>
        <article className="stat-card"><div className="stat-icon"><FileText size={20} /></div><div><span>Borradores</span><strong>{loading ? '—' : stats.draft}</strong><small>en elaboración</small></div></article>
        <article className="stat-card"><div className="stat-icon"><Clock3 size={20} /></div><div><span>En proceso</span><strong>{loading ? '—' : stats.inProgress}</strong><small>pendientes de cierre</small></div></article>
        <article className="stat-card"><div className="stat-icon"><CheckCircle2 size={20} /></div><div><span>Aprobados</span><strong>{loading ? '—' : stats.approved}</strong><small>vigentes</small></div></article>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card pending-card">
          <header className="card-heading-row">
            <div><span>PENDIENTES PRINCIPALES</span><h2>Documentos a seguir</h2></div>
            <Link to="/documents">Ver todos <ArrowRight size={14} /></Link>
          </header>
          <div className="pending-list">
            {loading ? <div className="dashboard-loading"><span className="loader-dot" /> Cargando…</div> : pendingDocuments.length === 0 ? (
              <div className="dashboard-empty"><CheckCircle2 size={23} /><strong>No hay pendientes</strong><span>Todos los documentos registrados están aprobados.</span></div>
            ) : pendingDocuments.map((document) => (
              <button className="pending-row" key={document.id} onClick={() => setSelectedDocumentId(document.id)}>
                <div className="pending-file-icon"><FileText size={17} /></div>
                <div className="pending-copy"><strong>{document.title}</strong><span>{document.module?.name || 'General'} · {document.responsible?.full_name || document.responsible?.email || 'Sin responsable'}</span></div>
                <StatusBadge status={document.status} />
              </button>
            ))}
          </div>
        </article>

        <article className="dashboard-card health-card">
          <header className="card-heading-row"><div><span>CONTROL DOCUMENTAL</span><h2>Estado general</h2></div></header>
          <div className="health-score"><strong>{approvedPercent}%</strong><span>documentos aprobados</span></div>
          <div className="progress-track"><span style={{ width: `${approvedPercent}%` }} /></div>
          <div className="health-legend">
            {Object.entries(DOCUMENT_STATUSES).map(([status, meta]) => {
              const value = status === 'draft' ? stats.draft : status === 'in_progress' ? stats.inProgress : stats.approved
              return <div key={status}><span className={`legend-dot legend-${status}`} /><span>{meta.label}</span><strong>{value}</strong></div>
            })}
          </div>
          <div className="assigned-callout"><div><span>Pendientes asignados a vos</span><strong>{stats.mine}</strong></div><Link to="/documents">Revisar</Link></div>
        </article>
      </div>

      <article className="dashboard-card recent-card">
        <header className="card-heading-row"><div><span>ACTIVIDAD RECIENTE</span><h2>Últimos documentos actualizados</h2></div><span className="module-count">{modules.length} módulos activos</span></header>
        {loading ? <div className="dashboard-loading"><span className="loader-dot" /> Cargando…</div> : recentDocuments.length === 0 ? (
          <div className="dashboard-empty"><FileText size={23} /><strong>La plataforma está lista</strong><span>Cargá el primer documento para comenzar a poblar el resumen.</span><Link className="primary-button" to="/documents">Ir a documentos</Link></div>
        ) : (
          <div className="recent-table-wrap"><table className="recent-table"><thead><tr><th>Documento</th><th>Tipo</th><th>Estado</th><th>Responsable</th><th>Actualizado</th></tr></thead><tbody>{recentDocuments.map((document) => <tr key={document.id} onClick={() => setSelectedDocumentId(document.id)}><td><strong>{document.title}</strong><span>{document.module?.name || 'General'}</span></td><td>{document.document_type}</td><td><StatusBadge status={document.status} /></td><td>{document.responsible?.full_name || document.responsible?.email || 'Sin asignar'}</td><td>{formatDate(document.updated_at)}</td></tr>)}</tbody></table></div>
        )}
      </article>

      <DocumentDetailDrawer documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} onChanged={load} />
    </section>
  )
}
