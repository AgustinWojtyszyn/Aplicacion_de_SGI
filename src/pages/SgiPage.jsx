import { CheckCircle2, ChevronRight, FileText, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../services/documentService'
import { listSgiRequirements } from '../services/sgiService'

const norms = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'SGI']

function documentsUrl({ norm, requirementId = '', chapter = '' }) {
  const params = new URLSearchParams()
  if (norm) params.set('norm', norm)
  if (requirementId) params.set('requirement', requirementId)
  if (chapter) params.set('chapter', String(chapter))
  return `/documents?${params.toString()}`
}

export default function SgiPage() {
  const { company } = useAuth()
  const [requirements, setRequirements] = useState([])
  const [documents, setDocuments] = useState([])
  const [selectedNorm, setSelectedNorm] = useState('ISO 9001')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!company?.id) return
    setLoading(true)
    setError('')
    try {
      const [nextRequirements, nextDocuments] = await Promise.all([
        listSgiRequirements(company.id),
        listDocuments({ companyId: company.id }),
      ])
      setRequirements(nextRequirements)
      setDocuments(nextDocuments)
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar el SGI.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id])

  const visible = requirements.filter((item) => item.norm === selectedNorm)
  const normStats = useMemo(() => Object.fromEntries(norms.map((norm) => {
    const normRequirements = requirements.filter((requirement) => requirement.norm === norm)
    const covered = normRequirements.filter((requirement) => (
      documents.some((document) => document.requirement_id === requirement.id && document.status === 'approved')
    )).length
    return [norm, {
      total: normRequirements.length,
      covered,
      percent: normRequirements.length ? Math.round((covered / normRequirements.length) * 100) : 0,
    }]
  })), [requirements, documents])

  const chapterStats = useMemo(() => {
    const grouped = new Map()
    visible.forEach((requirement) => {
      const key = String(requirement.chapter || '—')
      if (!grouped.has(key)) grouped.set(key, { chapter: key, total: 0, covered: 0, pending: 0 })
      const item = grouped.get(key)
      const related = documents.filter((document) => document.requirement_id === requirement.id)
      const covered = related.some((document) => document.status === 'approved')
      item.total += 1
      item.covered += covered ? 1 : 0
      item.pending += covered ? 0 : 1
    })
    return Array.from(grouped.values())
      .map((item) => ({ ...item, percent: item.total ? Math.round((item.covered / item.total) * 100) : 0 }))
      .sort((a, b) => Number(a.chapter) - Number(b.chapter))
  }, [visible, documents])

  return (
    <section className="page-stack sgi-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">SISTEMA DE GESTIÓN INTEGRADO</p>
          <h1>SGI e ISO</h1>
          <p>Documentación organizada por norma, capítulo y requisito.</p>
        </div>
      </header>

      {error && <div className="page-error">{error}</div>}

      <div className="norm-tabs">
        {norms.map((norm) => (
          <button
            key={norm}
            className={selectedNorm === norm ? 'norm-tab active' : 'norm-tab'}
            onClick={() => setSelectedNorm(norm)}
          >
            <ShieldCheck size={17} />
            <span>{norm === 'SGI' ? 'SGI Integrado' : norm}</span>
            <strong>{normStats[norm]?.percent || 0}%</strong>
          </button>
        ))}
      </div>

      <article className="sgi-summary-card">
        <div className="sgi-summary-heading">
          <div>
            <span>CUMPLIMIENTO DOCUMENTAL</span>
            <strong>{normStats[selectedNorm]?.percent || 0}%</strong>
            <small>{normStats[selectedNorm]?.covered || 0} de {normStats[selectedNorm]?.total || 0} requisitos con al menos un documento aprobado</small>
          </div>
          <Link className="secondary-button" to={documentsUrl({ norm: selectedNorm })}>
            <FileText size={16} /> Ver documentos de la norma
          </Link>
        </div>
        <div className="sgi-progress"><span style={{ width: `${normStats[selectedNorm]?.percent || 0}%` }} /></div>
      </article>

      <section className="compliance-matrix" aria-label={`Matriz de cumplimiento ${selectedNorm}`}>
        <div className="compliance-matrix-heading">
          <div><span>MATRIZ DE CUMPLIMIENTO</span><h2>{selectedNorm === 'SGI' ? 'SGI Integrado' : selectedNorm} por capítulo</h2></div>
          <small>El porcentaje cuenta requisitos con al menos una evidencia aprobada.</small>
        </div>
        <div className="compliance-matrix-grid">
          {chapterStats.map((item) => (
            <Link key={item.chapter} to={documentsUrl({ norm: selectedNorm, chapter: item.chapter })} className="compliance-chapter-card">
              <div className="compliance-chapter-top"><span>Cap. {item.chapter}</span><strong>{item.percent}%</strong></div>
              <div className="compliance-chapter-track"><span style={{ width: `${item.percent}%` }} /></div>
              <div className="compliance-chapter-meta"><span>{item.covered}/{item.total} cubiertos</span><span>{item.pending} pendientes</span></div>
            </Link>
          ))}
        </div>
      </section>

      <div className="requirement-list">
        {loading ? (
          <div className="dashboard-loading"><span className="loader-dot" /> Cargando estructura…</div>
        ) : visible.map((requirement) => {
          const related = documents.filter((document) => document.requirement_id === requirement.id)
          const approved = related.filter((document) => document.status === 'approved').length
          const pending = related.length - approved
          return (
            <article className="requirement-card" key={requirement.id}>
              <div className="requirement-chapter">{requirement.chapter}</div>
              <div className="requirement-copy">
                <span>{requirement.code}</span>
                <h2>{requirement.title}</h2>
                <p>{requirement.description}</p>
                <div className="requirement-meta">
                  <span><FileText size={14} /> {related.length} documento{related.length === 1 ? '' : 's'}</span>
                  <span><CheckCircle2 size={14} /> {approved} aprobados</span>
                  {pending > 0 && <span>{pending} pendientes</span>}
                </div>
              </div>
              <Link
                to={documentsUrl({ norm: requirement.norm, requirementId: requirement.id, chapter: requirement.chapter })}
                title={`Ver documentos del capítulo ${requirement.chapter}`}
                aria-label={`Ver documentos de ${requirement.norm}, capítulo ${requirement.chapter}`}
              >
                <ChevronRight size={20} />
              </Link>
            </article>
          )
        })}
      </div>
    </section>
  )
}
