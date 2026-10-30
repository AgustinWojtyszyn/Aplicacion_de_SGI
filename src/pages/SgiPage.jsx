import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Clock3, FilePlus2, FileText, FolderOpen, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DocumentDetailDrawer from '../components/DocumentDetailDrawer'
import DocumentFormModal from '../components/DocumentFormModal'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../services/documentService'
import { listReturnedDocumentIds, listSgiEvaluations, listSgiRequirements, saveSgiEvaluation } from '../services/sgiService'

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
    const chapterRoot = sorted.find((requirement) => !requirement.code.includes('.')) || null
    const root = chapterRoot || sorted[0]
    const clauses = sorted.filter((requirement) => requirement.code.includes('.'))
    // A chapter-level requirement can still own legacy documents. Once clauses
    // exist, it is excluded from the clause coverage denominator.
    const tracked = clauses.length ? clauses : sorted
    const ids = new Set(sorted.map((requirement) => requirement.id))
    const related = documents.filter((document) => ids.has(document.requirement_id))
    const covered = tracked.filter((requirement) => related.some((document) => document.requirement_id === requirement.id && document.status === 'approved')).length
    const approved = related.filter((document) => document.status === 'approved').length
    const historicApproved = clauses.length && chapterRoot
      ? related.filter((document) => document.requirement_id === chapterRoot.id && document.status === 'approved').length
      : 0
    return {
      chapter, root, requirements: tracked, legacyRoot: clauses.length ? chapterRoot : null,
      documents: related, total: tracked.length, covered, approved, historicApproved,
      pending: related.length - approved,
      percent: tracked.length ? Math.round(covered * 100 / tracked.length) : 0,
    }
  }).sort((a, b) => Number(a.chapter) - Number(b.chapter))
}

const evalLabel = (status) => EVALUATION_OPTIONS.find((option) => option.value === status)?.label || 'Sin evaluar'
const formatDate = (date) => date ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date)) : '—'

// Uses the existing documentary workflow; does not fabricate a separate
// corrective-action record or change existing document status semantics.
export function nextDocumentAction(document, now = new Date(), returned = false) {
  if (document.status === 'approved') return null
  const due = document.review_due_at ? new Date(document.review_due_at) : null
  const overdue = Boolean(due && !Number.isNaN(due.getTime()) && due < now)
  if (document.status === 'in_progress') {
    return {
      label: document.reviewed_at ? 'Pendiente de aprobación' : 'Pendiente de revisión',
      overdue,
      due: document.review_due_at,
    }
  }
  return { label: returned ? 'Corregir observaciones y reenviar' : 'Preparar y enviar a revisión', overdue, due: document.review_due_at }
}

function personName(person) {
  return person?.full_name || person?.email || 'Sin asignar'
}

export default function SgiPage() {
  const { company, user, role } = useAuth()
  const [params, setParams] = useSearchParams()
  const selectedNorm = NORMS.includes(params.get('norm')) ? params.get('norm') : 'ISO 9001'
  const selectedChapter = params.get('chapter') || ''
  const [requirements, setRequirements] = useState([])
  const [documents, setDocuments] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [evaluationAvailable, setEvaluationAvailable] = useState(false)
  const [loadedCompanyId, setLoadedCompanyId] = useState('')
  const [returnedDocumentIds, setReturnedDocumentIds] = useState([])
  const [returnedAvailable, setReturnedAvailable] = useState(true)
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
    if (company?.id) {
      Promise.all([
        listSgiRequirements(company.id),
        listDocuments({ companyId: company.id }),
        listSgiEvaluations(company.id),
        listReturnedDocumentIds(company.id).then((ids) => ({ ids, available: true })).catch((error) => {
          console.warn('No se pudo leer el historial de devoluciones', error)
          return { ids: [], available: false }
        }),
      ]).then(([nextRequirements, nextDocuments, result, returned]) => {
        if (!active) return
        setRequirements(nextRequirements)
        setDocuments(nextDocuments)
        setEvaluations(result.rows)
        setEvaluationAvailable(result.available)
        setReturnedDocumentIds(returned.ids)
        setReturnedAvailable(returned.available)
        setLoadedCompanyId(company.id)
      }).catch((loadError) => {
        if (active) setError(loadError.message || 'No se pudo cargar el SGI.')
      }).finally(() => { if (active) setLoading(false) })
    } else {
      setLoadedCompanyId('')
      setRequirements([])
      setDocuments([])
      setEvaluations([])
      setEvaluationAvailable(false)
      setReturnedDocumentIds([])
      setReturnedAvailable(false)
    }
    return () => { active = false }
  }, [company?.id, revision])

  useEffect(() => {
    setExpandedId('')
    setTab('documents')
    setSearch('')
    setStatus('')
  }, [selectedNorm, selectedChapter])

  // Never render cached data from another company while the new one loads.
  const currentRequirements = loadedCompanyId === company?.id ? requirements : []
  const currentDocuments = loadedCompanyId === company?.id ? documents : []
  const currentEvaluations = loadedCompanyId === company?.id ? evaluations : []
  const currentEvaluationAvailable = loadedCompanyId === company?.id && evaluationAvailable
  const currentReturnedDocumentIds = loadedCompanyId === company?.id ? returnedDocumentIds : []
  const groups = useMemo(
    () => Object.fromEntries(NORMS.map((norm) => [norm, getChapters(norm, currentRequirements, currentDocuments)])),
    [currentRequirements, currentDocuments],
  )
  const chapters = groups[selectedNorm]
  const chapter = chapters.find((item) => item.chapter === selectedChapter)
  const total = chapters.reduce((sum, item) => sum + item.total, 0)
  const covered = chapters.reduce((sum, item) => sum + item.covered, 0)
  const percent = total ? Math.round(covered * 100 / total) : 0
  const openedRequirement = chapter?.requirements.find((requirement) => requirement.id === expandedId) || chapter?.requirements[0] || null
  const evaluation = currentEvaluations.find((item) => item.requirement_id === openedRequirement?.id)
  const requirementDocuments = chapter?.documents.filter((document) => document.requirement_id === openedRequirement?.id) || []
  const visibleDocuments = requirementDocuments.filter((document) => {
    if (status === 'returned' && !currentReturnedDocumentIds.includes(document.id)) return false
    if (status === 'draft' && (document.status !== 'draft' || currentReturnedDocumentIds.includes(document.id))) return false
    if (status === 'review_pending' && (document.status !== 'in_progress' || document.reviewed_at)) return false
    if (status === 'approval_pending' && (document.status !== 'in_progress' || !document.reviewed_at)) return false
    if (status === 'approved' && document.status !== 'approved') return false
    const needle = search.trim().toLocaleLowerCase('es-AR')
    return !needle || [document.title, document.file_name, document.description].some((text) => (text || '').toLocaleLowerCase('es-AR').includes(needle))
  })
  const approvedDocuments = requirementDocuments.filter((document) => document.status === 'approved')
  const pendingDocuments = requirementDocuments.filter((document) => document.status !== 'approved')
  const canEvaluate = role === 'admin' || role === 'responsible'
  const actions = chapter?.documents.map((document) => ({ document, next: nextDocumentAction(document, new Date(), currentReturnedDocumentIds.includes(document.id)) })).filter(({ next }) => Boolean(next)) || []


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
    if (!openedRequirement || !canEvaluate || !currentEvaluationAvailable || saving) return
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
        {currentReturnedDocumentIds.includes(document.id) && <span className="sgi-returned-label">Devuelto para corrección</span>}
        <button type="button" className="secondary-button" onClick={() => setSelectedDocumentId(document.id)}>Ver ficha</button>
      </article>
    ))}</div>
  }

  return <section className="page-stack sgi-page" data-norm={selectedNorm}>
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
          return <button key={norm} type="button" data-norm={norm} className={selectedNorm === norm ? 'norm-tab active' : 'norm-tab'} onClick={() => changeNorm(norm)} aria-pressed={selectedNorm === norm}>
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
              {item.historicApproved > 0 && <small className="sgi-legacy-count">{item.historicApproved} aprobado{item.historicApproved === 1 ? '' : 's'} del capítulo sin vincular a subrequisito</small>}
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
        <div><strong>{actions.length}</strong><span>Acciones abiertas</span></div>
      </div>
      {chapter.historicApproved > 0 && <div className="sgi-historical-note"><FileText size={18} /><span>Hay {chapter.historicApproved} documento{chapter.historicApproved === 1 ? '' : 's'} aprobado{chapter.historicApproved === 1 ? '' : 's'} del capítulo anterior a la división por subrequisitos. Se conserva{chapter.historicApproved === 1 ? '' : 'n'} sin reasignar. El porcentaje actual mide únicamente la cobertura documentada de cada subrequisito.</span></div>}
      <section className="sgi-detail-content">
        <header className="sgi-detail-section-heading"><div><span>REQUISITOS DEL CAPÍTULO</span><h2>Requisitos y evidencias</h2></div><small>Elegí un requisito para consultar su documentación y su evaluación.</small></header>
        <div className="sgi-clause-list">
          {chapter.requirements.map((requirement) => {
            const isOpen = openedRequirement?.id === requirement.id
            const related = chapter.documents.filter((document) => document.requirement_id === requirement.id)
            const existingEvaluation = currentEvaluations.find((entry) => entry.requirement_id === requirement.id)
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
                  {currentEvaluationAvailable ? <div className="sgi-evaluation-fields">
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
                    {[['', 'Todos'], ['draft', 'Borrador'], ['review_pending', 'Pendiente de revisión'], ['approval_pending', 'Pendiente de aprobación'], ['approved', 'Aprobado'], ['returned', 'Devuelto']].map(([value, label]) => <button type="button" key={value} className={status === value ? 'active' : ''} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}
                  </div>
                  {!returnedAvailable && <small className="sgi-returned-warning">No se pudo consultar el historial de devoluciones; el filtro «Devuelto» puede estar incompleto.</small>}
                  {documentList(visibleDocuments)}
                  <Link className="sgi-all-documents" to={'/documents?norm=' + encodeURIComponent(selectedNorm) + '&requirement=' + encodeURIComponent(requirement.id) + '&chapter=' + encodeURIComponent(chapter.chapter)}><FolderOpen size={16} /> Abrir carpeta y subcarpetas</Link>
                </section>}
                {tab === 'verify' && <section className="sgi-review-panel">
                  <div className="sgi-review-counts">
                    <span><CheckCircle2 size={18} /> {approvedDocuments.length} aprobados</span>
                    <span><Clock3 size={18} /> {pendingDocuments.length} por verificar</span>
                  </div>
                  <p>La verificación se realiza desde la ficha documental. El responsable autorizado registra la revisión y el aprobador confirma el resultado. La evaluación de cumplimiento de este requisito se guarda por separado.</p>
                  {requirementDocuments.map((document) => (
                    <article key={document.id} className="sgi-action-row">
                      <div>
                        <strong>{document.title}</strong>
                        <small>Revisor: {personName(document.reviewer)} · Aprobador: {personName(document.approver)}</small>
                        <small>{document.status === 'approved' ? 'Aprobación registrada' : nextDocumentAction(document, new Date(), currentReturnedDocumentIds.includes(document.id))?.label}</small>
                      </div>
                      <StatusBadge status={document.status} />
                      <button type="button" className="secondary-button" onClick={() => setSelectedDocumentId(document.id)}>Verificar ficha</button>
                    </article>
                  ))}
                  {!requirementDocuments.length && <p className="sgi-empty">Todavía no hay documentos para verificar.</p>}
                </section>}
                {tab === 'actions' && <section className="sgi-review-panel">
                  <h3>Acciones documentales abiertas</h3>
                  <p>Se muestran las tareas pendientes del flujo documental existente. No son acciones correctivas independientes y no se crean registros nuevos.</p>
                  {pendingDocuments.map((document) => {
                    const next = nextDocumentAction(document, new Date(), currentReturnedDocumentIds.includes(document.id))
                    return <article key={document.id} className="sgi-action-row">
                      <div>
                        <strong>{document.title}</strong>
                        <small>{next.label}</small>
                        <small>Responsable: {personName(document.responsible)} · {next.due ? 'Fecha objetivo: ' + formatDate(next.due) : 'Sin fecha objetivo'}</small>
                        {next.overdue && <span className="sgi-overdue"><AlertTriangle size={14} /> Plazo vencido</span>}
                      </div>
                      <button type="button" className="secondary-button" onClick={() => setSelectedDocumentId(document.id)}>Gestionar</button>
                    </article>
                  })}
                  {!pendingDocuments.length && <p className="sgi-empty">No hay acciones documentales pendientes para este requisito.</p>}
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
