import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  GitBranch,
  MessageSquareWarning,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DocumentDetailDrawer from '../components/DocumentDetailDrawer'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../services/documentService'
import { getSgiDashboardMetrics, listNotifications, listSgiRequirements } from '../services/sgiService'

const NORMS = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'SGI']

function firstName(profile) {
  return profile?.full_name?.trim()?.split(/\s+/)[0] || 'bienvenido'
}

function daysBetween(a, b) {
  return Math.max(0, (new Date(b) - new Date(a)) / 86400000)
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function formatPercent(value) {
  return `${round1(value)}%`
}

function approvalSignal(avgDays, approvedCount) {
  if (!approvedCount) return { label: 'Sin datos', tone: 'neutral', detail: 'Todavía no hay aprobaciones completas.' }
  if (avgDays <= 3) return { label: 'Óptimo', tone: 'good', detail: 'Promedio de hasta 3 días.' }
  if (avgDays <= 7) return { label: 'Atención', tone: 'warning', detail: 'Promedio entre 4 y 7 días.' }
  return { label: 'Crítico', tone: 'danger', detail: 'Promedio superior a 7 días.' }
}

export default function DashboardPage() {
  const { company, profile, user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [requirements, setRequirements] = useState([])
  const [notifications, setNotifications] = useState([])
  const [advancedMetrics, setAdvancedMetrics] = useState(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!company?.id) return
    setLoading(true)
    setError('')
    try {
      const [nextDocuments, nextRequirements, nextNotifications, nextAdvancedMetrics] = await Promise.all([
        listDocuments({ companyId: company.id }),
        listSgiRequirements(company.id),
        listNotifications(),
        getSgiDashboardMetrics(company.id),
      ])
      setDocuments(nextDocuments)
      setRequirements(nextRequirements)
      setNotifications(nextNotifications)
      setAdvancedMetrics(nextAdvancedMetrics)
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

  const metrics = useMemo(() => {
    const approved = documents.filter((document) => document.status === 'approved')
    const drafts = documents.filter((document) => document.status === 'draft')
    const inProgress = documents.filter((document) => document.status === 'in_progress')
    const overdue = documents.filter((document) => (
      document.status !== 'approved'
      && document.review_due_at
      && new Date(document.review_due_at) < new Date()
    ))
    const covered = requirements.filter((requirement) => (
      approved.some((document) => document.requirement_id === requirement.id)
    )).length
    const approvalTimes = approved
      .filter((document) => document.submitted_for_review_at && document.approved_at)
      .map((document) => daysBetween(document.submitted_for_review_at, document.approved_at))
    const avgApprovalFallback = approvalTimes.length
      ? round1(approvalTimes.reduce((sum, value) => sum + value, 0) / approvalTimes.length)
      : 0
    const mine = documents.filter((document) => (
      document.status !== 'approved'
      && [document.responsible_id, document.reviewer_id, document.approver_id].includes(user?.id)
    )).length
    const notificationsHandled = notifications.filter((notification) => notification.read_at).length
    const reviewedDocuments = documents.filter((document) => document.reviewed_at).length
    const submittedDocuments = documents.filter((document) => document.submitted_for_review_at || document.status === 'approved').length
    const approvedWithDueDate = approved.filter((document) => document.review_due_at)
    const approvedOnTime = approvedWithDueDate.filter((document) => (
      document.approved_at && new Date(document.approved_at) <= new Date(document.review_due_at)
    )).length
    const fallbackVersions = approved.length
      ? round1(approved.reduce((sum, document) => sum + Number(document.current_version || 1), 0) / approved.length)
      : 0

    return {
      total: advancedMetrics?.total_documents ?? documents.length,
      drafts: advancedMetrics?.draft_documents ?? drafts.length,
      inProgress: advancedMetrics?.in_progress_documents ?? inProgress.length,
      approved: advancedMetrics?.approved_documents ?? approved.length,
      pending: documents.length - approved.length,
      overdue: overdue.length,
      coverage: requirements.length ? Math.round((covered / requirements.length) * 100) : 0,
      avgApproval: round1(advancedMetrics?.avg_approval_days ?? avgApprovalFallback),
      mine,
      unread: notifications.filter((notification) => !notification.read_at).length,
      observationRate: advancedMetrics ? round1(advancedMetrics.observation_rate) : null,
      onTimeRate: advancedMetrics
        ? round1(advancedMetrics.on_time_approval_rate)
        : approvedWithDueDate.length ? round1((approvedOnTime / approvedWithDueDate.length) * 100) : 0,
      reviewerResponse: advancedMetrics
        ? round1(advancedMetrics.reviewer_response_rate)
        : submittedDocuments ? round1((reviewedDocuments / submittedDocuments) * 100) : 0,
      approverResponse: advancedMetrics
        ? round1(advancedMetrics.approver_response_rate)
        : reviewedDocuments ? round1((approved.length / reviewedDocuments) * 100) : 0,
      avgVersions: advancedMetrics
        ? round1(advancedMetrics.avg_versions_before_approval)
        : fallbackVersions,
      alertHandledRate: advancedMetrics
        ? round1(advancedMetrics.alert_handled_rate)
        : notifications.length ? round1((notificationsHandled / notifications.length) * 100) : 0,
    }
  }, [advancedMetrics, documents, requirements, notifications, user?.id])

  const normRanking = useMemo(() => NORMS.map((norm) => {
    const normRequirements = requirements.filter((requirement) => requirement.norm === norm)
    const covered = normRequirements.filter((requirement) => (
      documents.some((document) => document.requirement_id === requirement.id && document.status === 'approved')
    )).length
    return {
      norm,
      total: normRequirements.length,
      covered,
      percent: normRequirements.length ? Math.round((covered / normRequirements.length) * 100) : 0,
    }
  }).sort((a, b) => b.percent - a.percent), [documents, requirements])

  const statusTotal = Math.max(metrics.total, 1)
  const signal = approvalSignal(metrics.avgApproval, metrics.approved)
  const pending = documents.filter((document) => document.status !== 'approved').slice(0, 6)

  const qualityMetrics = [
    {
      label: 'Con observaciones',
      value: metrics.observationRate == null ? '—' : formatPercent(metrics.observationRate),
      detail: 'documentos devueltos durante revisión',
      icon: MessageSquareWarning,
    },
    {
      label: 'Aprobados en término',
      value: formatPercent(metrics.onTimeRate),
      detail: 'respecto de la fecha objetivo',
      icon: CheckCircle2,
    },
    {
      label: 'Respuesta revisores',
      value: formatPercent(metrics.reviewerResponse),
      detail: 'revisiones atendidas',
      icon: UsersRound,
    },
    {
      label: 'Respuesta aprobadores',
      value: formatPercent(metrics.approverResponse),
      detail: 'aprobaciones sobre revisiones',
      icon: ShieldCheck,
    },
    {
      label: 'Versiones por aprobado',
      value: metrics.avgVersions.toFixed(1),
      detail: 'promedio antes de aprobación',
      icon: GitBranch,
    },
    {
      label: 'Alertas atendidas',
      value: formatPercent(metrics.alertHandledRate),
      detail: 'notificaciones marcadas como leídas',
      icon: Activity,
    },
  ]

  return (
    <section className="page-stack dashboard-page">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">DASHBOARD SGI</p>
          <h1>Hola, {firstName(profile)}.</h1>
          <p>Seguimiento documental, cumplimiento, revisiones y alertas de {company?.name || 'tu organización'}.</p>
        </div>
        <button className="icon-button dashboard-refresh" onClick={load} aria-label="Actualizar dashboard" title="Actualizar">
          <RefreshCw size={18} />
        </button>
      </header>

      {error && <div className="page-error">{error}</div>}

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-icon"><FolderOpen size={20} /></div>
          <div><span>Documentos</span><strong>{loading ? '—' : metrics.total}</strong><small>{metrics.pending} pendientes</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><ShieldCheck size={20} /></div>
          <div><span>Cumplimiento ISO</span><strong>{loading ? '—' : `${metrics.coverage}%`}</strong><small>requisitos cubiertos</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><Clock3 size={20} /></div>
          <div><span>Tiempo aprobación</span><strong>{loading ? '—' : `${metrics.avgApproval} d`}</strong><small>promedio del flujo</small></div>
        </article>
        <article className="stat-card">
          <div className="stat-icon"><AlertTriangle size={20} /></div>
          <div><span>Alertas</span><strong>{loading ? '—' : metrics.overdue + metrics.unread}</strong><small>{metrics.overdue} vencidos · {metrics.unread} sin leer</small></div>
        </article>
      </div>

      <div className="meeting-dashboard-grid">
        <article className="dashboard-card visual-card">
          <header className="card-heading-row"><div><span>FLUJO DOCUMENTAL</span><h2>Estado de la documentación</h2></div><BarChart3 size={18} /></header>
          <div className="status-visual-list">
            <div className="status-visual-row"><div><span>Borrador</span><strong>{metrics.drafts}</strong></div><div className="status-visual-track"><span className="status-draft-bar" style={{ width: `${(metrics.drafts / statusTotal) * 100}%` }} /></div></div>
            <div className="status-visual-row"><div><span>En proceso</span><strong>{metrics.inProgress}</strong></div><div className="status-visual-track"><span className="status-progress-bar" style={{ width: `${(metrics.inProgress / statusTotal) * 100}%` }} /></div></div>
            <div className="status-visual-row"><div><span>Aprobado</span><strong>{metrics.approved}</strong></div><div className="status-visual-track"><span className="status-approved-bar" style={{ width: `${(metrics.approved / statusTotal) * 100}%` }} /></div></div>
          </div>
        </article>

        <article className="dashboard-card visual-card">
          <header className="card-heading-row"><div><span>CUMPLIMIENTO POR NORMA</span><h2>Ranking ISO / SGI</h2></div><ShieldCheck size={18} /></header>
          <div className="norm-ranking-list">
            {normRanking.map((item) => (
              <div className="norm-ranking-row" key={item.norm}>
                <div><strong>{item.norm === 'SGI' ? 'SGI Integrado' : item.norm}</strong><span>{item.covered}/{item.total} requisitos</span><b>{item.percent}%</b></div>
                <div className="norm-ranking-track"><span style={{ width: `${item.percent}%` }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card approval-signal-card">
          <header className="card-heading-row"><div><span>TIEMPO DE APROBACIÓN</span><h2>Semáforo operativo</h2></div><Clock3 size={18} /></header>
          <div className="approval-signal-body">
            <div className={`approval-signal-light ${signal.tone}`}><span /></div>
            <div><strong>{signal.label}</strong><b>{metrics.approved ? `${metrics.avgApproval} días` : '—'}</b><p>{signal.detail}</p></div>
          </div>
          <div className="signal-legend"><span>≤ 3 d óptimo</span><span>4–7 d atención</span><span>&gt; 7 d crítico</span></div>
        </article>
      </div>

      <section className="dashboard-kpi-section">
        <div className="dashboard-section-heading"><div><span>INDICADORES DE DESEMPEÑO</span><h2>KPIs solicitados para el flujo SGI</h2></div></div>
        <div className="quality-kpi-grid">
          {qualityMetrics.map(({ label, value, detail, icon: Icon }) => (
            <article className="quality-kpi-card" key={label}>
              <div className="quality-kpi-icon"><Icon size={18} /></div>
              <span>{label}</span>
              <strong>{loading ? '—' : value}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <article className="dashboard-card pending-card">
          <header className="card-heading-row"><div><span>PENDIENTES PRINCIPALES</span><h2>Documentos a seguir</h2></div><Link to="/documents">Ver todos</Link></header>
          <div className="pending-list">
            {pending.length === 0
              ? <div className="dashboard-empty"><CheckCircle2 size={23} /><strong>Sin pendientes</strong></div>
              : pending.map((document) => (
                <button className="pending-row" key={document.id} onClick={() => setSelectedDocumentId(document.id)}>
                  <div className="pending-file-icon"><FileText size={17} /></div>
                  <div className="pending-copy"><strong>{document.title}</strong><span>{document.requirement ? `${document.norm} · Cap. ${document.requirement.chapter}` : document.norm || 'General'}</span></div>
                  <StatusBadge status={document.status} />
                </button>
              ))}
          </div>
        </article>

        <article className="dashboard-card health-card">
          <header className="card-heading-row"><div><span>MI TRABAJO</span><h2>Seguimiento personal</h2></div></header>
          <div className="health-score"><strong>{metrics.mine}</strong><span>documentos que requieren tu intervención</span></div>
          <div className="assigned-callout"><div><span>Notificaciones sin leer</span><strong>{metrics.unread}</strong></div><Link to="/notifications">Ver alertas</Link></div>
          <div className="assigned-callout"><div><span>Documentos vencidos</span><strong>{metrics.overdue}</strong></div><Link to="/documents">Revisar</Link></div>
        </article>
      </div>

      <DocumentDetailDrawer documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} onChanged={load} />
    </section>
  )
}
