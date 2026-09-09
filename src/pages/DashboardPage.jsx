import { AlertTriangle, CheckCircle2, Clock3, FileText, FolderOpen, RefreshCw, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DocumentDetailDrawer from '../components/DocumentDetailDrawer'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../services/documentService'
import { listNotifications, listSgiRequirements } from '../services/sgiService'

function firstName(profile) { return profile?.full_name?.trim()?.split(/\s+/)[0] || 'bienvenido' }
function daysBetween(a, b) { return Math.max(0, (new Date(b) - new Date(a)) / 86400000) }

export default function DashboardPage() {
  const { company, profile, user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [requirements, setRequirements] = useState([])
  const [notifications, setNotifications] = useState([])
  const [selectedDocumentId, setSelectedDocumentId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load() { if (!company?.id) return; setLoading(true); setError(''); try { const [d,r,n] = await Promise.all([listDocuments({companyId:company.id}), listSgiRequirements(company.id), listNotifications()]); setDocuments(d); setRequirements(r); setNotifications(n) } catch(e) { setError(e.message || 'No se pudo cargar el resumen.') } finally { setLoading(false) } }
  useEffect(() => { load() }, [company?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const metrics = useMemo(() => {
    const approved = documents.filter(d => d.status === 'approved')
    const overdue = documents.filter(d => d.status !== 'approved' && d.review_due_at && new Date(d.review_due_at) < new Date())
    const covered = requirements.filter(r => approved.some(d => d.requirement_id === r.id)).length
    const approvalTimes = approved.filter(d => d.submitted_for_review_at && d.approved_at).map(d => daysBetween(d.submitted_for_review_at, d.approved_at))
    const avgApproval = approvalTimes.length ? Math.round((approvalTimes.reduce((a,b)=>a+b,0)/approvalTimes.length)*10)/10 : 0
    const mine = documents.filter(d => d.status !== 'approved' && [d.responsible_id,d.reviewer_id,d.approver_id].includes(user?.id)).length
    return { total: documents.length, approved: approved.length, pending: documents.length-approved.length, overdue: overdue.length, coverage: requirements.length ? Math.round((covered/requirements.length)*100) : 0, avgApproval, mine, unread: notifications.filter(n=>!n.read_at).length }
  }, [documents, requirements, notifications, user?.id])
  const pending = documents.filter(d=>d.status!=='approved').slice(0,6)

  return <section className="page-stack dashboard-page"><header className="dashboard-hero"><div><p className="eyebrow">DASHBOARD SGI</p><h1>Hola, {firstName(profile)}.</h1><p>Seguimiento documental, cumplimiento, revisiones y alertas de {company?.name || 'SF Higiene'}.</p></div><button className="icon-button dashboard-refresh" onClick={load}><RefreshCw size={18} /></button></header>{error && <div className="page-error">{error}</div>}
    <div className="stats-grid"><article className="stat-card"><div className="stat-icon"><FolderOpen size={20}/></div><div><span>Documentos</span><strong>{loading?'—':metrics.total}</strong><small>{metrics.pending} pendientes</small></div></article><article className="stat-card"><div className="stat-icon"><ShieldCheck size={20}/></div><div><span>Cumplimiento ISO</span><strong>{loading?'—':`${metrics.coverage}%`}</strong><small>capítulos cubiertos</small></div></article><article className="stat-card"><div className="stat-icon"><Clock3 size={20}/></div><div><span>Tiempo aprobación</span><strong>{loading?'—':`${metrics.avgApproval} d`}</strong><small>promedio</small></div></article><article className="stat-card"><div className="stat-icon"><AlertTriangle size={20}/></div><div><span>Alertas</span><strong>{loading?'—':metrics.overdue + metrics.unread}</strong><small>{metrics.overdue} vencidos · {metrics.unread} sin leer</small></div></article></div>
    <div className="dashboard-grid"><article className="dashboard-card pending-card"><header className="card-heading-row"><div><span>PENDIENTES PRINCIPALES</span><h2>Documentos a seguir</h2></div><Link to="/documents">Ver todos</Link></header><div className="pending-list">{pending.length===0?<div className="dashboard-empty"><CheckCircle2 size={23}/><strong>Sin pendientes</strong></div>:pending.map(d=><button className="pending-row" key={d.id} onClick={()=>setSelectedDocumentId(d.id)}><div className="pending-file-icon"><FileText size={17}/></div><div className="pending-copy"><strong>{d.title}</strong><span>{d.requirement ? `${d.norm} · Cap. ${d.requirement.chapter}` : d.norm || 'General'}</span></div><StatusBadge status={d.status}/></button>)}</div></article><article className="dashboard-card health-card"><header className="card-heading-row"><div><span>MI TRABAJO</span><h2>Seguimiento personal</h2></div></header><div className="health-score"><strong>{metrics.mine}</strong><span>documentos que requieren tu intervención</span></div><div className="assigned-callout"><div><span>Notificaciones sin leer</span><strong>{metrics.unread}</strong></div><Link to="/notifications">Ver alertas</Link></div><div className="assigned-callout"><div><span>Documentos vencidos</span><strong>{metrics.overdue}</strong></div><Link to="/documents">Revisar</Link></div></article></div>
    <DocumentDetailDrawer documentId={selectedDocumentId} onClose={()=>setSelectedDocumentId(null)} onChanged={load}/>
  </section>
}
