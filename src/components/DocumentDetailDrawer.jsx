import { CheckCircle2, Download, FilePlus2, FileText, MessageSquarePlus, Pencil, RotateCcw, Save, Send, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DOCUMENT_STATUSES, DOCUMENT_TYPE_OPTIONS, NORM_OPTIONS } from '../lib/constants'
import { useAuth } from '../context/AuthContext'
import { canDeleteDocument, canManageDocument } from '../lib/permissions'
import { listSgiRequirements } from '../services/sgiService'
import {
  addDocumentComment, approveDocument, createDocumentVersion, deleteDocument, getDocumentDetail,
  listCompanyMembers, openDocumentFile, rejectDocument, reviewDocument, submitDocumentForReview,
  updateDocumentMetadata,
} from '../services/documentService'
import StatusBadge from './StatusBadge'

function formatDateTime(value) { return value ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—' }
function formatDateInput(value) { return value ? new Date(value).toISOString().slice(0, 10) : '' }
function personLabel(person) { return person?.full_name || person?.email || 'Usuario' }
function activityCopy(item) {
  const labels = { created: 'Creó el documento', responsible_changed: 'Cambió el responsable', metadata_updated: 'Actualizó los datos', version_created: `Creó la versión ${item.details?.version || ''}`, submitted_for_review: 'Envió a revisión', reviewed: 'Registró la revisión', rejected: 'Solicitó cambios', approved: 'Aprobó el documento' }
  if (labels[item.action]) return labels[item.action]
  if (item.action === 'status_changed') return `Cambió de ${DOCUMENT_STATUSES[item.from_status]?.label || item.from_status} a ${DOCUMENT_STATUSES[item.to_status]?.label || item.to_status}`
  return 'Actualizó el documento'
}

export default function DocumentDetailDrawer({ documentId, onClose, onChanged }) {
  const { company, user, modules, role } = useAuth()
  const [detail, setDetail] = useState(null)
  const [members, setMembers] = useState([])
  const [requirements, setRequirements] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [workflowComment, setWorkflowComment] = useState('')
  const [reviewerId, setReviewerId] = useState('')
  const [approverId, setApproverId] = useState('')
  const [reviewDueAt, setReviewDueAt] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editValues, setEditValues] = useState(null)
  const [versionFile, setVersionFile] = useState(null)
  const [versionComment, setVersionComment] = useState('')

  const document = detail?.document
  const latestVersion = detail?.versions?.[0]
  const canManage = canManageDocument({ role, userId: user?.id, document })
  const canDelete = canDeleteDocument({ role, userId: user?.id, document })
  const canReview = document?.status === 'in_progress' && (role === 'admin' || document?.reviewer_id === user?.id)
  const canApprove = document?.status === 'in_progress' && Boolean(document?.reviewed_at) && (role === 'admin' || document?.approver_id === user?.id)
  const canReject = document?.status === 'in_progress' && (role === 'admin' || document?.reviewer_id === user?.id || document?.approver_id === user?.id)
  const visibleRequirements = useMemo(() => requirements.filter((r) => editValues?.norm && editValues.norm !== 'General' && r.norm === editValues.norm), [requirements, editValues?.norm])

  async function load() {
    if (!documentId || !company?.id) return
    setLoading(true); setError('')
    try {
      const [nextDetail, nextMembers, nextRequirements] = await Promise.all([getDocumentDetail(documentId), listCompanyMembers(company.id), listSgiRequirements(company.id)])
      const d = nextDetail.document
      setDetail(nextDetail); setMembers(nextMembers); setRequirements(nextRequirements)
      setReviewerId(d.reviewer_id || ''); setApproverId(d.approver_id || ''); setReviewDueAt(formatDateInput(d.review_due_at))
      setEditValues({ title: d.title, description: d.description || '', documentType: d.document_type, norm: d.norm || 'General', moduleId: d.module_id || '', requirementId: d.requirement_id || '', responsibleId: d.responsible_id || '', reviewDueAt: formatDateInput(d.review_due_at) })
    } catch (e) { console.error(e); setError(e.message || 'No se pudo cargar el detalle.') } finally { setLoading(false) }
  }
  useEffect(() => { load(); setEditMode(false); setComment(''); setWorkflowComment(''); setVersionFile(null); setVersionComment('') }, [documentId]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!documentId) return null

  async function runChange(action) { setSaving(true); setError(''); try { await action(); await load(); onChanged?.(); setWorkflowComment('') } catch (e) { console.error(e); setError(e.message || 'No se pudo guardar el cambio.') } finally { setSaving(false) } }
  async function handleMetadataSave(e) { e.preventDefault(); await runChange(() => updateDocumentMetadata(documentId, editValues)); setEditMode(false) }
  async function handleComment(e) { e.preventDefault(); await runChange(() => addDocumentComment({ documentId, authorId: user.id, comment })); setComment('') }
  async function handleVersion(e) { e.preventDefault(); if (!versionFile) return; await runChange(() => createDocumentVersion({ companyId: company.id, documentId, file: versionFile, comment: versionComment })); setVersionFile(null); setVersionComment('') }
  async function handleDelete() { if (!document || !canDelete || saving || !window.confirm(`¿Eliminar "${document.title}"?`)) return; setSaving(true); try { await deleteDocument({ documentId: document.id, filePath: document.file_path }); onChanged?.(); onClose?.() } catch (e) { setError(e.message) } finally { setSaving(false) } }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar detalle" /><aside className="document-drawer" role="dialog" aria-modal="true">
    <header className="drawer-header"><div><p className="eyebrow">SGI · CONTROL DOCUMENTAL</p><div className="drawer-title-row"><FileText size={20} /><h2>{document?.title || 'Documento'}</h2></div></div><button className="icon-button" onClick={onClose}><X size={20} /></button></header>
    {loading && !detail ? <div className="drawer-loading"><span className="loader-dot" /> Cargando…</div> : document ? <div className="drawer-body">
      <section className="drawer-summary"><div className="drawer-status-row"><StatusBadge status={document.status} /><span>Versión {document.current_version} · actualizado {formatDateTime(document.updated_at)}</span></div><p>{document.description || 'Sin descripción adicional.'}</p><div className="drawer-actions"><button className="secondary-button" onClick={() => openDocumentFile(latestVersion?.file_path || document.file_path)}><Download size={17} /> Abrir versión actual</button>{canDelete && <button className="danger-button" onClick={handleDelete} disabled={saving}><Trash2 size={17} /> Eliminar</button>}</div></section>
      {error && <div className="form-error" role="alert">{error}</div>}

      <section className="drawer-section"><div className="drawer-section-heading"><div><span>FLUJO FORMAL</span><h3>Revisión y aprobación</h3></div></div>
        {document.status === 'draft' && canManage ? <div className="workflow-panel"><div className="form-grid two-cols"><label className="field"><span>Revisor *</span><select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}><option value="">Seleccionar</option>{members.map(({ user: m }) => <option key={m.id} value={m.id}>{personLabel(m)}</option>)}</select></label><label className="field"><span>Aprobador *</span><select value={approverId} onChange={(e) => setApproverId(e.target.value)}><option value="">Seleccionar</option>{members.map(({ user: m }) => <option key={m.id} value={m.id}>{personLabel(m)}</option>)}</select></label><label className="field"><span>Fecha objetivo</span><input type="date" value={reviewDueAt} onChange={(e) => setReviewDueAt(e.target.value)} /></label><label className="field field-wide"><span>Nota de envío</span><textarea rows={2} value={workflowComment} onChange={(e) => setWorkflowComment(e.target.value)} /></label></div><button className="primary-button" disabled={!reviewerId || !approverId || saving} onClick={() => runChange(() => submitDocumentForReview({ documentId, reviewerId, approverId, reviewDueAt, comment: workflowComment }))}><Send size={16} /> Enviar a revisión</button></div> : null}
        {document.status === 'in_progress' ? <div className="workflow-panel"><div className="workflow-people"><span>Revisor: <strong>{personLabel(document.reviewer)}</strong>{document.reviewed_at ? ` · revisado ${formatDateTime(document.reviewed_at)}` : ' · pendiente'}</span><span>Aprobador: <strong>{personLabel(document.approver)}</strong></span></div><textarea rows={2} value={workflowComment} onChange={(e) => setWorkflowComment(e.target.value)} placeholder="Comentario de revisión / aprobación…" /> <div className="drawer-actions">{canReview && !document.reviewed_at && <button className="secondary-button" onClick={() => runChange(() => reviewDocument(documentId, workflowComment))} disabled={saving}><CheckCircle2 size={16} /> Registrar revisión</button>}{canApprove && <button className="primary-button" onClick={() => runChange(() => approveDocument(documentId, workflowComment))} disabled={saving}><CheckCircle2 size={16} /> Aprobar documento</button>}{canReject && <button className="danger-button" onClick={() => runChange(() => rejectDocument(documentId, workflowComment))} disabled={!workflowComment.trim() || saving}><RotateCcw size={16} /> Solicitar cambios</button>}</div></div> : null}
        {document.status === 'approved' && <div className="workflow-approved"><CheckCircle2 size={20} /><span>Aprobado {formatDateTime(document.approved_at)} · documento vigente y bloqueado para edición.</span></div>}
      </section>

      <section className="drawer-section"><div className="drawer-section-heading"><div><span>INFORMACIÓN</span><h3>Clasificación y responsables</h3></div>{canManage && document.status !== 'approved' && !editMode && <button className="text-action" onClick={() => setEditMode(true)}><Pencil size={15} /> Editar</button>}</div>
        {editMode ? <form className="detail-edit-form" onSubmit={handleMetadataSave}><label className="field field-wide"><span>Título</span><input value={editValues.title} onChange={(e) => setEditValues(v => ({...v,title:e.target.value}))} required /></label><label className="field"><span>Tipo</span><select value={editValues.documentType} onChange={(e) => setEditValues(v => ({...v,documentType:e.target.value}))}>{DOCUMENT_TYPE_OPTIONS.map(i => <option key={i}>{i}</option>)}</select></label><label className="field"><span>Norma</span><select value={editValues.norm} onChange={(e) => setEditValues(v => ({...v,norm:e.target.value, requirementId:''}))}>{NORM_OPTIONS.map(i => <option key={i}>{i}</option>)}</select></label><label className="field field-wide"><span>Requisito ISO</span><select value={editValues.requirementId} onChange={(e) => setEditValues(v => ({...v,requirementId:e.target.value}))}><option value="">Sin requisito</option>{visibleRequirements.map(r => <option key={r.id} value={r.id}>Cap. {r.chapter} · {r.title}</option>)}</select></label><label className="field"><span>Módulo</span><select value={editValues.moduleId} onChange={(e) => setEditValues(v => ({...v,moduleId:e.target.value}))}><option value="">General</option>{modules.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label className="field"><span>Responsable</span><select value={editValues.responsibleId} onChange={(e) => setEditValues(v => ({...v,responsibleId:e.target.value}))}><option value="">Sin asignar</option>{members.map(({user:m}) => <option key={m.id} value={m.id}>{personLabel(m)}</option>)}</select></label><label className="field"><span>Fecha objetivo</span><input type="date" value={editValues.reviewDueAt} onChange={(e) => setEditValues(v => ({...v,reviewDueAt:e.target.value}))} /></label><label className="field field-wide"><span>Descripción</span><textarea rows={3} value={editValues.description} onChange={(e) => setEditValues(v => ({...v,description:e.target.value}))} /></label><div className="detail-edit-actions field-wide"><button className="secondary-button" type="button" onClick={() => setEditMode(false)}>Cancelar</button><button className="primary-button" disabled={saving}><Save size={16} /> Guardar</button></div></form> : <dl className="metadata-grid"><div><dt>Norma</dt><dd>{document.norm || 'General'}</dd></div><div><dt>Requisito</dt><dd>{document.requirement ? `Cap. ${document.requirement.chapter} · ${document.requirement.title}` : 'Sin requisito'}</dd></div><div><dt>Responsable</dt><dd>{document.responsible ? personLabel(document.responsible) : 'Sin asignar'}</dd></div><div><dt>Fecha objetivo</dt><dd>{formatDateTime(document.review_due_at)}</dd></div><div><dt>Creado por</dt><dd>{personLabel(document.creator)}</dd></div><div><dt>Versión actual</dt><dd>v{document.current_version}</dd></div></dl>}
      </section>

      <section className="drawer-section"><div className="drawer-section-heading"><div><span>VERSIONES</span><h3>Historial de archivos</h3></div></div>{canManage && document.status !== 'approved' && <form className="version-upload" onSubmit={handleVersion}><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp" onChange={(e) => setVersionFile(e.target.files?.[0] || null)} /><input value={versionComment} onChange={(e) => setVersionComment(e.target.value)} placeholder="Comentario de la versión" /><button className="secondary-button" disabled={!versionFile || saving}><FilePlus2 size={16} /> Nueva versión</button></form>}<div className="version-list">{detail.versions.map(v => <button key={v.id} onClick={() => openDocumentFile(v.file_path)}><strong>v{v.version_number} · {v.file_name}</strong><span>{personLabel(v.creator)} · {formatDateTime(v.created_at)}{v.comment ? ` · ${v.comment}` : ''}</span></button>)}</div></section>

      <section className="drawer-section"><div className="drawer-section-heading"><div><span>OBSERVACIONES</span><h3>Seguimiento</h3></div></div><form className="comment-form" onSubmit={handleComment}><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} /><button className="primary-button" disabled={!comment.trim() || saving}><MessageSquarePlus size={16} /> Guardar observación</button></form><div className="comments-list">{detail.comments.map(i => <article className="comment-item" key={i.id}><div className="comment-avatar">{personLabel(i.author).charAt(0).toUpperCase()}</div><div><div className="comment-meta"><strong>{personLabel(i.author)}</strong><span>{formatDateTime(i.created_at)}</span></div><p>{i.comment}</p></div></article>)}</div></section>
      <section className="drawer-section"><div className="drawer-section-heading"><div><span>TRAZABILIDAD</span><h3>Historial</h3></div></div><div className="activity-list">{detail.activity.map(i => <div className="activity-item" key={i.id}><span className="activity-dot" /><div><strong>{activityCopy(i)}</strong><p>{personLabel(i.actor)} · {formatDateTime(i.created_at)}</p>{i.details?.comment && <p>{i.details.comment}</p>}</div></div>)}</div></section>
    </div> : null}
  </aside></div>
}
