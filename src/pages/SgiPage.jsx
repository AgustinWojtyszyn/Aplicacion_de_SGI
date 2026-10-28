import { ArrowLeft, CheckCircle2, ChevronDown, FilePlus2, FileText, FolderOpen, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DocumentDetailDrawer from '../components/DocumentDetailDrawer'
import DocumentFormModal from '../components/DocumentFormModal'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../services/documentService'
import { listSgiEvaluations, listSgiRequirements, saveSgiEvaluation } from '../services/sgiService'

const NORMS = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'SGI']
const EVALUATION_OPTIONS = [
  { value: 'not_evaluated', label: 'Sin evaluar' },
  { value: 'compliant', label: 'Cumple' },
  { value: 'partial', label: 'Cumple parcialmente' },
  { value: 'non_compliant', label: 'No cumple' },
  { value: 'not_applicable', label: 'No aplica' },
]

export function getChapters(norm, requirements, documents) {
  const groups = new Map()
  requirements.filter((requirement) => requirement.norm === norm).forEach((requirement) => {
    const chapter = String(requirement.chapter)
    if (!groups.has(chapter)) groups.set(chapter, [])
    groups.get(chapter).push(requirement)
  })
  return Array.from(groups, ([chapter, entries]) => {
    const sorted = [...entries].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    const root = sorted.find((requirement) => !requirement.code.includes('.')) || sorted[0]
    const clauses = sorted.filter((requirement) => requirement.code.includes('.'))
    // A chapter-level requirement can still own legacy documents. Once clauses
    // exist, it is excluded from the clause coverage denominator.
    const tracked = clauses.length ? clauses : sorted
    const ids = new Set(sorted.map((requirement) => requirement.id))
    const related = documents.filter((document) => ids.has(document.requirement_id))
    const covered = tracked.filter((requirement) => related.some((document) => document.requirement_id === requirement.id && document.status === 'approved')).length
    const approved = related.filter((document) => document.status === 'approved').length
    return {
      chapter, root, requirements: tracked, legacyRoot: clauses.length ? root : null,
      documents: related, total: tracked.length, covered, approved,
      pending: related.length - approved,
      percent: tracked.length ? Math.round(covered * 100 / tracked.length) : 0,
    }
  }).sort((a, b) => Number(a.chapter) - Number(b.chapter))
}

const evalLabel = (status) => EVALUATION_OPTIONS.find((option) => option.value === status)?.label || 'Sin evaluar'
const formatDate = (date) => date ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date)) : '—'

export default function SgiPage() {
  const { company, user, role } = useAuth()
  const [params, setParams] = useSearchParams()
  const selectedNorm = NORMS.includes(params.get('norm')) ? params.get('norm') : 'ISO 9001'
  const selectedChapter = params.get('chapter') || ''
  const [requirements, setRequirements] = useState([])
  const [documents, setDocuments] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [evaluationAvailable, setEvaluationAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [expandedId, setExpandedId] = useState('')
  const [tab, setTab] = useState('documents')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [draftStatus, setDraftStatus] = useState('not_evaluated')
  const [draftRemarks, setDraftRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createRequirementId, setCreateRequirementId] = useState('')

  function reload() { setRevision((current) => current + 1) }

  useEffect(() => {
    let active = true
    setLoading(Boolean(company?.id))
    setError('')
    setRequirements([])
    setDocuments([])
    setEvaluations([])
    setEvaluationAvailable(false)
    if (company?.id) {
      Promise.all([
        listSgiRequirements(company.id),
        listDocuments({ companyId: company.id }),
        listSgiEvaluations(company.id),
      ]).then(([nextRequirements, nextDocuments, result]) => {
        if (!active) return
        setRequirements(nextRequirements)
        setDocuments(nextDocuments)
        setEvaluations(result.rows)
        setEvaluationAvailable(result.available)
      }).catch((loadError) => {
        if (active) setError(loadError.message || 'No se pudo cargar el SGI.')
      }).finally(() => { if (active) setLoading(false) })
    }
    return () => { active = false }
  }, [company?.id, revision])

  useEffect(() => {
    setExpandedId('')
    setTab('documents')
    setSearch('')
    setStatus('')
  }, [selectedNorm, selectedChapter])

  const groups = useMemo(
    () => Object.fromEntries(NORMS.map((norm) => [norm, getChapters(norm, requirements, documents)])),
    [requirements, documents],
  )
  const chapters = groups[selectedNorm]
  const chapter = chapters.find((item) => item.chapter === selectedChapter)
  const total = chapters.reduce((sum, item) => sum + item.total, 0)
  const covered = chapters.reduce((sum, item) => sum + item.covered, 0)
  const percent = total ? Math.round(covered * 100 / total) : 0
  const openedRequirement = chapter?.requirements.find((requirement) => requirement.id === expandedId) || chapter?.requirements[0] || null
  const evaluation = evaluations.find((item) => item.requirement_id === openedRequirement?.id)
  const requirementDocuments = chapter?.documents.filter((document) => document.requirement_id === openedRequirement?.id) || []
  const visibleDocuments = requirementDocuments.filter((document) => {
    if (status && document.status !== status) return false
    const needle = search.trim().toLocaleLowerCase('es-AR')
    return !needle || [document.title, document.file_name, document.description].some((text) => (text || '').toLocaleLowerCase('es-AR').includes(needle))
  })
  const approvedDocuments = requirementDocuments.filter((document) => document.status === 'approved')
  const pendingDocuments = requirementDocuments.filter((document) => document.status !== 'approved')
  const canEvaluate = role === 'admin' || role === 'responsible'

  useEffect(() => {
    setDraftStatus(evaluation?.status || 'not_evaluated')
    setDraftRemarks(evaluation?.remarks || '')
    setSearch('')
    setStatus('')
    setTab('documents')
  }, [openedRequirement?.id, evaluation?.status, evaluation?.remarks])

  function changeNorm(norm) { setParams({ norm }) }
  function changeChapter(number) { setParams({ norm: selectedNorm, chapter: String(number) }) }

  function openUpload(requirementId) {
    setCreateRequirementId(requirementId)
    setCreateOpen(true)
  }

  async function saveEvaluation() {
    if (!openedRequirement || !canEvaluate || !evaluationAvailable || saving) return
    setSaving(true)
    setError('')
    try {
      await saveSgiEvaluation({
        companyId: company.id, requirementId: openedRequirement.id,
        userId: user.id, status: draftStatus, remarks: draftRemarks.trim(),
      })
      const result = await listSgiEvaluations(company.id)
      setEvaluations(result.rows)
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar la evaluación.')
    } finally {
      setSaving(false)
    }
  }

  function documentList(items) {
    if (!items.length) return <p className="sgi-empty">No hay documentos en esta sección.</p>
    return <div className="sgi-evidence-list">{items.map((document) => (
      <article key={document.id} className="sgi-evidence-row">
        <span className="sgi-evidence-icon"><FileText size={18} /></span>
        <div className="sgi-evidence-copy">
          <strong>{document.title}</strong>
          <small>{document.file_name} · {formatDate(document.updated_at)}</small>
        </div>
        <StatusBadge status={document.status} />
        <button type="button" className="secondary-button" onClick={() => setSelectedDocumentId(document.id)}>Ver ficha</button>
      </article>
    ))}</div>
  }

  return <section className="page-stack sgi-page">
    {!chapter ? <>
      <header className="page-heading">
        <div><p className="eyebrow">SISTEMA DE GESTIÓN INTEGRADO</p><h1>SGI e ISO</h1>
          <p>Documentación, progreso y requisitos en una sola vista por capítulo.</p></div>
        <button type="button" className="secondary-button" onClick={reload} disabled={loading}><RefreshCw size={16} /> Actualizar</button>
      </header>
      <div className="norm-tabs" role="group" aria-label="Seleccionar norma">
        {NORMS.map((norm) => {
          const normTotal = groups[norm].reduce((sum, item) => sum + item.total, 0)
          const normCovered = groups[norm].reduce((sum, item) => sum + item.covered, 0)
          return <button key={norm} type="button" className={selectedNorm === norm ? 'norm-tab active' : 'norm-tab'} onClick={() => changeNorm(norm)} aria-pressed={selectedNorm === norm}>
            <ShieldCheck size={17} /><span>{norm === 'SGI' ? 'SGI Integrado' : norm}</span>
            <strong>{normTotal ? Math.round(normCovered * 100 / normTotal) : 0}%</strong>
          </button>
        })}
      </div>
      {error && <div className="page-error" role="alert">{error}</div>}
      <section className="compliance-matrix" aria-label={'Capítulos de ' + selectedNorm}>
        <header className="compliance-matrix-heading">
          <div><span>MATRIZ DE CUMPLIMIENTO</span><h2>{selectedNorm === 'SGI' ? 'SGI Integrado' : selectedNorm} por capítulo</h2>
            <p>{covered} de {total} requisitos con evidencia aprobada · {percent}% de cobertura</p></div>
          <small>La cobertura documental cuenta requisitos con al menos un documento aprobado. La evaluación de cumplimiento se registra por separado.</small>
        </header>
        {loading ? <div className="dashboard-loading"><span className="loader-dot" /> Cargando estructura…</div>
          : chapters.length ? <div className="compliance-matrix-grid">
            {chapters.map((item) => <button key={item.chapter} type="button" className="compliance-chapter-card" onClick={() => changeChapter(item.chapter)}>
              <div className="compliance-chapter-top"><span>CAPÍTULO {item.chapter}</span><strong>{item.percent}%</strong></div>
              <h3>{item.root.title}</h3>
              <p>{item.root.description || 'Documentación y evidencias del capítulo.'}</p>
              <div className="compliance-chapter-track"><span style={{ width: item.percent + '%' }} /></div>
              <div className="compliance-chapter-meta"><span><CheckCircle2 size={14} /> {item.covered}/{item.total} cubiertos</span><span><FileText size={14} /> {item.documents.length} documentos</span></div>
              <span className="sgi-chapter-action">Abrir capítulo <ChevronDown size={15} /></span>
            </button>)}
          </div> : <p className="sgi-empty">No hay capítulos disponibles para esta norma.</p>}
      </section>
    </> : <>
      <div className="sgi-breadcrumbs"><Link to={'/sgi?norm=' + encodeURIComponent(selectedNorm)}><ArrowLeft size={16} /> Volver a capítulos</Link><span>{selectedNorm} / Capítulo {chapter.chapter}</span></div>
      <header className="sgi-detail-heading"><div>
        <p className="eyebrow">{selectedNorm} · CAPÍTULO {chapter.chapter}</p><h1>{chapter.root.title}</h1>
        <p>{chapter.root.description || 'Implementación, documentación y evaluación de requisitos.'}</p>
      </div><button type="button" className="secondary-button" onClick={reload} disabled={loading}><RefreshCw size={16} /> Actualizar</button></header>
      {error && <div className="page-error" role="alert">{error}</div>}
      <div className="sgi-detail-metrics">
        <div><strong>{chapter.total}</strong><span>Requisitos</span></div>
        <div><strong>{chapter.documents.length}</strong><span>Documentos registrados</span></div>
        <div><strong>{chapter.approved}</strong><span>Aprobados</span></div>
        <div><strong>{chapter.pending}</strong><span>Pendientes documentales</span></div>
      </div>
      <section className="sgi-detail-content">
        <header className="sgi-detail-section-heading"><div><span>REQUISITOS DEL CAPÍTULO</span><h2>Requisitos y evidencias</h2></div><small>Elegí un requisito para consultar su documentación y su evaluación.</small></header>
        <div className="sgi-clause-list">
          {chapter.requirements.map((requirement) => {
            const isOpen = openedRequirement?.id === requirement.id
            const related = chapter.documents.filter((document) => document.requirement_id === requirement.id)
            const existingEvaluation = evaluations.find((entry) => entry.requirement_id === requirement.id)
            return <article key={requirement.id} className={'sgi-clause' + (isOpen ? ' open' : '')}>
              <button type="button" className="sgi-clause-trigger" onClick={() => setExpandedId(requirement.id)} aria-expanded={isOpen}>
                <span className="sgi-clause-code">{requirement.code.split('-').pop()}</span>
                <span className="sgi-clause-copy"><strong>{requirement.title}</strong><small>{related.length} documento{related.length === 1 ? '' : 's'} · {evalLabel(existingEvaluation?.status)}</small></span>
                <ChevronDown size={18} />
              </button>
              {isOpen && <div className="sgi-clause-panel">
                <p className="sgi-clause-description">{requirement.description || 'Sin descripción adicional.'}</p>
                <section className="sgi-evaluation-panel">
                  <div className="sgi-evaluation-heading"><div><strong>Evaluación de cumplimiento</strong><small>La evaluación manual no cambia automáticamente al aprobar un documento.</small></div><span className="sgi-evaluation-badge">{evalLabel(evaluation?.status)}</span></div>
                  {evaluationAvailable ? <div className="sgi-evaluation-fields">
                    <label className="field"><span>Resultado</span><select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)} disabled={!canEvaluate || saving}>
                      {EVALUATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select></label>
                    <label className="field"><span>Observaciones</span><textarea rows={2} maxLength={2000} value={draftRemarks} onChange={(event) => setDraftRemarks(event.target.value)} disabled={!canEvaluate || saving} placeholder="Fundamentos o hallazgos…" /></label>
                    {canEvaluate && <button type="button" className="primary-button" onClick={saveEvaluation} disabled={saving || (draftStatus === (evaluation?.status || 'not_evaluated') && draftRemarks.trim() === (evaluation?.remarks || ''))}>{saving ? 'Guardando…' : 'Guardar evaluación'}</button>}
                  </div> : <p className="sgi-evaluation-unavailable">La evaluación manual requiere activar la migración de base de datos. Los documentos y sus aprobaciones siguen funcionando.</p>}
                </section>
                <div className="sgi-detail-tabs" role="group" aria-label="Detalle del requisito">
                  {[['documents', 'Documentos'], ['verify', 'Verificar'], ['actions', 'Acciones']].map(([value, label]) => <button type="button" key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)} aria-pressed={tab === value}>{label}</button>)}
                </div>
                {tab === 'documents' && <section className="sgi-documents-panel">
                  <div className="sgi-documents-heading"><div><h3>Evidencias y documentos</h3><p>Documentos vinculados a este requisito.</p></div>
                    <button type="button" className="primary-button" onClick={() => openUpload(requirement.id)}><FilePlus2 size={16} /> Cargar</button></div>
                  <label className="sgi-document-search"><Search size={17} /><input aria-label="Buscar documentos" placeholder="Buscar por nombre o código…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                  <div className="sgi-document-filters" role="group" aria-label="Filtrar documentos">
                    {[['', 'Todos'], ['draft', 'Borrador'], ['in_progress', 'En proceso'], ['approved', 'Aprobado']].map(([value, label]) => <button type="button" key={value} className={status === value ? 'active' : ''} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}
                  </div>
                  {documentList(visibleDocuments)}
                  <Link className="sgi-all-documents" to={'/documents?norm=' + encodeURIComponent(selectedNorm) + '&requirement=' + encodeURIComponent(requirement.id) + '&chapter=' + encodeURIComponent(chapter.chapter)}><FolderOpen size={16} /> Abrir carpeta y subcarpetas</Link>
                </section>}
                {tab === 'verify' && <section className="sgi-review-panel">
                  <div className="sgi-review-counts"><span><CheckCircle2 size={18} /> {approvedDocuments.length} aprobados</span><span>{pendingDocuments.length} pendientes</span></div>
                  <p>La revisión y aprobación formal se realiza desde la ficha documental, según los responsables asignados.</p>
                  {documentList(approvedDocuments)}
                </section>}
                {tab === 'actions' && <section className="sgi-review-panel">
                  <h3>Documentos que requieren seguimiento</h3><p>Desde la ficha podés ver fechas, solicitar cambios y continuar las aprobaciones según tus permisos.</p>
                  {documentList(pendingDocuments)}
                </section>}
              </div>}
            </article>
          })}
        </div>
        {chapter.legacyRoot && chapter.documents.some((document) => document.requirement_id === chapter.legacyRoot.id) && <section className="sgi-legacy-documents">
          <div><h3>Documentación general del capítulo</h3><p>Se conservan los archivos anteriores a la división en requisitos específicos.</p></div>
          {documentList(chapter.documents.filter((document) => document.requirement_id === chapter.legacyRoot.id))}
        </section>}
      </section>
    </>}
    <DocumentFormModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={reload} defaultNorm={selectedNorm} defaultRequirementId={createRequirementId} />
    <DocumentDetailDrawer documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} onChanged={reload} />
  </section>
}
