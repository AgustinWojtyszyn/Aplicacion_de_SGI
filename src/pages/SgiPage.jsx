import { CheckCircle2, ChevronRight, FileText, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../services/documentService'
import { listSgiRequirements } from '../services/sgiService'

const norms = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'SGI']

export default function SgiPage() {
  const { company } = useAuth()
  const [requirements, setRequirements] = useState([])
  const [documents, setDocuments] = useState([])
  const [selectedNorm, setSelectedNorm] = useState('ISO 9001')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!company?.id) return
    setLoading(true); setError('')
    try {
      const [nextRequirements, nextDocuments] = await Promise.all([
        listSgiRequirements(company.id),
        listDocuments({ companyId: company.id }),
      ])
      setRequirements(nextRequirements); setDocuments(nextDocuments)
    } catch (e) { setError(e.message || 'No se pudo cargar el SGI.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [company?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = requirements.filter((item) => item.norm === selectedNorm)
  const normStats = useMemo(() => Object.fromEntries(norms.map((norm) => {
    const reqs = requirements.filter((r) => r.norm === norm)
    const covered = reqs.filter((r) => documents.some((d) => d.requirement_id === r.id && d.status === 'approved')).length
    return [norm, { total: reqs.length, covered, percent: reqs.length ? Math.round((covered / reqs.length) * 100) : 0 }]
  })), [requirements, documents])

  return <section className="page-stack sgi-page">
    <header className="page-heading"><div><p className="eyebrow">SISTEMA DE GESTIÓN INTEGRADO</p><h1>SGI e ISO</h1><p>Documentación organizada por norma, capítulo y requisito.</p></div></header>
    {error && <div className="page-error">{error}</div>}
    <div className="norm-tabs">{norms.map((norm) => <button key={norm} className={selectedNorm === norm ? 'norm-tab active' : 'norm-tab'} onClick={() => setSelectedNorm(norm)}><ShieldCheck size={17} /><span>{norm}</span><strong>{normStats[norm]?.percent || 0}%</strong></button>)}</div>
    <article className="sgi-summary-card"><div><span>CUMPLIMIENTO DOCUMENTAL</span><strong>{normStats[selectedNorm]?.percent || 0}%</strong><small>{normStats[selectedNorm]?.covered || 0} de {normStats[selectedNorm]?.total || 0} capítulos con al menos un documento aprobado</small></div><div className="sgi-progress"><span style={{ width: `${normStats[selectedNorm]?.percent || 0}%` }} /></div></article>
    <div className="requirement-list">{loading ? <div className="dashboard-loading"><span className="loader-dot" /> Cargando estructura…</div> : visible.map((requirement) => {
      const related = documents.filter((d) => d.requirement_id === requirement.id)
      const approved = related.filter((d) => d.status === 'approved').length
      const pending = related.length - approved
      return <article className="requirement-card" key={requirement.id}><div className="requirement-chapter">{requirement.chapter}</div><div className="requirement-copy"><span>{requirement.code}</span><h2>{requirement.title}</h2><p>{requirement.description}</p><div className="requirement-meta"><span><FileText size={14} /> {related.length} documento{related.length === 1 ? '' : 's'}</span><span><CheckCircle2 size={14} /> {approved} aprobados</span>{pending > 0 && <span>{pending} pendientes</span>}</div></div><Link to="/documents" title="Ver documentos"><ChevronRight size={20} /></Link></article>
    })}</div>
  </section>
}
