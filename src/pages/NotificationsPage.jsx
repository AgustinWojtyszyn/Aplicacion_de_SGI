import { BellRing, Check, Clock3, FileWarning } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../services/documentService'
import { listNotifications, markNotificationRead } from '../services/sgiService'

function formatDate(value) { return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }

export default function NotificationsPage() {
  const { company } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!company?.id) return
    setLoading(true); setError('')
    try {
      const [nextNotifications, nextDocuments] = await Promise.all([listNotifications(), listDocuments({ companyId: company.id })])
      setNotifications(nextNotifications); setDocuments(nextDocuments)
    } catch (e) { setError(e.message || 'No se pudieron cargar las alertas.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [company?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const overdue = useMemo(() => documents.filter((d) => d.status !== 'approved' && d.review_due_at && new Date(d.review_due_at) < new Date()), [documents])
  async function markRead(id) { try { await markNotificationRead(id); setNotifications((items) => items.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)) } catch (e) { setError(e.message) } }

  return <section className="page-stack alerts-page"><header className="page-heading"><div><p className="eyebrow">SEGUIMIENTO</p><h1>Alertas y notificaciones</h1><p>Revisiones, aprobaciones, cambios solicitados y vencimientos.</p></div></header>{error && <div className="page-error">{error}</div>}
    {overdue.length > 0 && <article className="overdue-panel"><header><FileWarning size={20} /><div><strong>{overdue.length} documento{overdue.length === 1 ? '' : 's'} vencido{overdue.length === 1 ? '' : 's'}</strong><span>Superaron su fecha objetivo de revisión.</span></div></header>{overdue.map((d) => <div className="overdue-row" key={d.id}><span>{d.title}</span><small><Clock3 size={13} /> {formatDate(d.review_due_at)}</small><Link to="/documents">Revisar</Link></div>)}</article>}
    <div className="notification-list">{loading ? <div className="dashboard-loading"><span className="loader-dot" /> Cargando…</div> : notifications.length === 0 ? <div className="dashboard-empty"><BellRing size={24} /><strong>Sin notificaciones</strong><span>Los eventos del flujo SGI aparecerán acá.</span></div> : notifications.map((item) => <article key={item.id} className={`notification-card ${item.read_at ? 'read' : 'unread'}`}><div className="notification-icon"><BellRing size={18} /></div><div><strong>{item.title}</strong><p>{item.message}</p><span>{formatDate(item.created_at)}</span></div><div className="notification-actions">{item.document_id && <Link to="/documents">Abrir</Link>}{!item.read_at && <button className="icon-button" onClick={() => markRead(item.id)} title="Marcar leída"><Check size={17} /></button>}</div></article>)}</div>
  </section>
}
