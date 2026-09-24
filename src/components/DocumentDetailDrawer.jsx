import { CheckCircle2, Download, FilePlus2, FileText, Folder, Mail, MessageSquarePlus, Pencil, RefreshCw, RotateCcw, Save, Send, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DOCUMENT_STATUSES, DOCUMENT_TYPE_OPTIONS, NORM_OPTIONS } from '../lib/constants'
import { useAuth } from '../context/AuthContext'
import { canDeleteDocument, canManageDocument } from '../lib/permissions'
import { listSgiRequirements } from '../services/sgiService'
import {
  addDocumentComment, approveDocument, checkReviewEmailStatus, createDocumentVersion, deleteDocument, getDocumentDetail,
  listCompanyMembers, listDocumentFolders, moveDocumentToFolder, openDocumentFile, rejectDocument, reviewDocument, sendReviewEmail, submitDocumentForReview,
  updateDocumentMetadata,
} from '../services/documentService'
import StatusBadge from './StatusBadge'

function formatDateTime(value) { return value ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—' }
function formatDateInput(value) { return value ? new Date(value).toISOString().slice(0, 10) : '' }
function personLabel(person) { return person?.full_name || person?.email || 'Usuario' }
function emailStatusLabel(status) {
  const labels = {
    sent: 'Enviado al proveedor',
    queued: 'En cola',
    delivery_delayed: 'Entrega demorada',
    delivered: 'Entrega confirmada',
    opened: 'Entregado y abierto',
    clicked: 'Entregado y abierto',
    bounced: 'Correo rebotado',
    complained: 'Marcado como spam',
    failed: 'Falló la entrega',
    canceled: 'Envío cancelado',
  }
  return labels[status] || 'Verificando entrega'
}
function activityCopy(item) {
  const labels = { created: 'Creó el documento', responsible_changed: 'Cambió el responsable', metadata_updated: 'Actualizó los datos', version_created: `Creó la versión ${item.details?.version || ''}`, submitted_for_review: 'Envió a revisión', reviewed: 'Registró la revisión', rejected: 'Solicitó cambios', approved: 'Aprobó el documento', review_email_sent: 'Envió correo de revisión', review_email_delivered: 'Correo de revisión entregado', review_email_failed: 'Falló el correo de revisión' }
  if (labels[item.action]) return labels[item.action]
  if (item.action === 'status_changed') return `Cambió de ${DOCUMENT_STATUSES[item.from_status]?.label || item.from_status} a ${DOCUMENT_STATUSES[item.to_status]?.label || item.to_status}`
  return 'Actualizó el documento'
}

export default function DocumentDetailDrawer({ documentId, onClose, onChanged }) {
  const { company, user, modules, role } = useAuth()
  const [detail, setDetail] = useState(null)
  const [members, setMembers] = useState([])
  const [requirements, setRequirements] = useState([])
  const [folders, setFolders] = useState([])
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveFolderId, setMoveFolderId] = useState('')
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
  const [emailRecipientId, setEmailRecipientId] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailDelivery, setEmailDelivery] = useState(null)

  const document = detail?.document
  const latestVersion = detail?.versions?.[0]
  const canManage = canManageDocument({ role, userId: user?.id, document })
  const canSendReviewEmail = Boolean(document && user?.id && (
    role === 'admin'
    || role === 'responsible'
    || document.created_by === user.id
    || document.responsible_id === user.id
  ))
  const canDelete = canDeleteDocument({ role, userId: user?.id, document })
  const canReview = document?.status === 'in_progress' && (role === 'admin' || document?.reviewer_id === user?.id)
  const canApprove = document?.status === 'in_progress' && Boolean(document?.reviewed_at) && (role === 'admin' || document?.approver_id === user?.id)
  const canReject = document?.status === 'in_progress' && (role === 'admin' || document?.reviewer_id === user?.id || document?.approver_id === user?.id)
  const visibleRequirements = useMemo(() => requirements.filter((r) => editValues?.norm && editValues.norm !== 'General' && r.norm === editValues.norm), [requirements, editValues?.norm])
  const selectedReviewer = members.find(({ user: member }) => member.id === reviewerId)?.user
  const selectedApprover = members.find(({ user: member }) => member.id === approverId)?.user
  const selectedEmailRecipient = members.find(({ user: member }) => member.id === emailRecipientId)?.user
  const folderOptions = useMemo(() => {
    if (!document?.requirement_id) return []
    const scoped = folders.filter((folder) => folder.requirement_id === document.requirement_id)
    const byParent = new Map()
    scoped.forEach((folder) => {
      const parent = folder.parent_id || ''
      if (!byParent.has(parent)) byParent.set(parent, [])
      byParent.get(parent).push(folder)
    })
    const result = []
    const walk = (parentId = '', depth = 0) => {
      ;(byParent.get(parentId) || []).forEach((folder) => {
        result.push({ ...folder, depth })
        walk(folder.id, depth + 1)
      })
    }
    walk()
    return result
  }, [folders, document?.requirement_id])
  const currentFolder = folders.find((folder) => folder.id === document?.folder_id) || null

  async function load() {
    if (!documentId || !company?.id) return
    setLoading(true); setError('')
    try {
      const [nextDetail, nextMembers, nextRequirements, nextFolders] = await Promise.all([getDocumentDetail(documentId), listCompanyMembers(company.id), listSgiRequirements(company.id), listDocumentFolders(company.id)])
      const d = nextDetail.document
      setDetail(nextDetail); setMembers(nextMembers); setRequirements(nextRequirements); setFolders(nextFolders)
      setReviewerId(d.reviewer_id || ''); setApproverId(d.approver_id || ''); setReviewDueAt(formatDateInput(d.review_due_at))
      setEmailRecipientId((current) => current || d.reviewer_id || '')
      setMoveFolderId(d.folder_id || '')
      setEditValues({ title: d.title, description: d.description || '', documentType: d.document_type, norm: d.norm || 'General', moduleId: d.module_id || '', requirementId: d.requirement_id || '', folderId: d.folder_id || '', responsibleId: d.responsible_id || '', reviewDueAt: formatDateInput(d.review_due_at) })
    } catch (e) { console.error(e); setError(e.message || 'No se pudo cargar el detalle.') } finally { setLoading(false) }
  }
  useEffect(() => { setEmailRecipientId(''); setEmailDelivery(null); setMoveOpen(false); load(); setEditMode(false); setComment(''); setWorkflowComment(''); setVersionFile(null); setVersionComment('') }, [documentId]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!documentId) return null

  async function runChange(action) { setSaving(true); setError(''); try { await action(); await load(); onChanged?.(); setWorkflowComment('') } catch (e) { console.error(e); setError(e.message || 'No se pudo guardar el cambio.') } finally { setSaving(false) } }
  async function handleMetadataSave(e) { e.preventDefault(); await runChange(() => updateDocumentMetadata(documentId, editValues)); setEditMode(false) }
  async function handleComment(e) { e.preventDefault(); await runChange(() => addDocumentComment({ documentId, authorId: user.id, comment })); setComment('') }
  async function handleVersion(e) { e.preventDefault(); if (!versionFile) return; await runChange(() => createDocumentVersion({ companyId: company.id, documentId, file: versionFile, comment: versionComment })); setVersionFile(null); setVersionComment('') }
  async function handleMove() {
    if (!document?.requirement_id || saving || (document.folder_id || '') === moveFolderId) return
    await runChange(() => moveDocumentToFolder({ documentId, folderId: moveFolderId || null }))
    setMoveOpen(false)
  }

  function applyEmailStatus(result) {
    const recipient = result.recipient || selectedEmailRecipient
    setEmailDelivery({
      emailId: result.emailId,
      status: result.status || 'sent',
      delivered: Boolean(result.delivered),
      failed: Boolean(result.failed),
      recipientName: recipient?.name || recipient?.full_name || recipient?.email || personLabel(selectedEmailRecipient),
      recipientEmail: recipient?.email || selectedEmailRecipient?.email || '',
    })
  }

  async function checkEmailDelivery(emailId, { schedule = false, attempt = 0 } = {}) {
    if (!emailId) return
    try {
      const result = await checkReviewEmailStatus({ companyId: company.id, documentId, emailId })
      applyEmailStatus({ ...result, emailId })
      if (schedule && !result.delivered && !result.failed && attempt < 4) {
        const delays = [1800, 3000, 4500, 6500, 8500]
        window.setTimeout(() => checkEmailDelivery(emailId, { schedule: true, attempt: attempt + 1 }), delays[attempt] || 8500)
      }
    } catch (statusError) {
      console.error(statusError)
      if (!schedule) setError(statusError.message || 'No se pudo comprobar la entrega del correo.')
    }
  }

  async function handleSendReviewEmail() {
    if (!emailRecipientId || emailSending) return
    setEmailSending(true)
    setError('')
    setEmailDelivery(null)
    try {
      const result = await sendReviewEmail({
        companyId: company.id,
        documentId,
        recipientUserId: emailRecipientId,
        note: workflowComment,
      })
      applyEmailStatus(result)
      window.setTimeout(() => checkEmailDelivery(result.emailId, { schedule: true }), 1200)
      await load()
      onChanged?.()
    } catch (sendError) {
      console.error(sendError)
      setError(sendError.message || 'No se pudo enviar el correo.')
    } finally {
      setEmailSending(false)
    }
  }

  async function handleSubmitForReview() {
    if (!reviewerId || !approverId || !emailRecipientId || saving) return
    setSaving(true)
    setError('')
    try {
      await submitDocumentForReview({ documentId, reviewerId, approverId, reviewDueAt, comment: workflowComment })
      let emailFailure = ''
      try {
        const result = await sendReviewEmail({
          companyId: company.id,
          documentId,
          recipientUserId: emailRecipientId,
          note: workflowComment,
        })
        applyEmailStatus(result)
        window.setTimeout(() => checkEmailDelivery(result.emailId, { schedule: true }), 1200)
      } catch (sendError) {
        console.error(sendError)
        emailFailure = `La revisión quedó enviada, pero el correo no salió: ${sendError.message || 'error de envío'}`
      }
      await load()
      onChanged?.()
      setWorkflowComment('')
      if (emailFailure) setError(emailFailure)
    } catch (submitError) {
      console.error(submitError)
      setError(submitError.message || 'No se pudo enviar a revisión.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() { if (!document || !canDelete || saving || !window.confirm(`¿Eliminar "${document.title}"?`)) return; setSaving(true); try { await deleteDocument({ documentId: document.id, filePath: document.file_path }); onChanged?.(); onClose?.() } catch (e) { setError(e.message) } finally { setSaving(false) } }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar detalle" /><aside className="document-drawer" role="dialog" aria-modal="true">
    <header className="drawer-header"><div><p className="eyebrow">SGI · CONTROL DOCUMENTAL</p><div className="drawer-title-row"><FileText size={20} /><h2>{document?.title || 'Documento'}</h2></div></div><button className="icon-button" onClick={onClose}><X size={20} /></button></header>
    {loading && !detail ? <div className="drawer-loading"><span className="loader-dot" /> Cargando…</div> : document ? <div className="drawer-body">
      <section className="drawer-summary"><div className="drawer-status-row"><StatusBadge status={document.status} /><span>Versión {document.current_version} · actualizado {formatDateTime(document.updated_at)}</span></div><p>{document.description || 'Sin descripción adicional.'}</p><div className="drawer-actions"><button className="secondary-button" onClick={() => openDocumentFile(latestVersion?.file_path || document.file_path)}><Download size={17} /> Abrir versión actual</button>{canManage && document.requirement_id && <button className="secondary-button" type="button" onClick={() => { setMoveFolderId(document.folder_id || ''); setMoveOpen((open) => !open) }}><Folder size={17} /> Mover</button>}{canDelete && <button className="danger-button" onClick={handleDelete} disabled={saving}><Trash2 size={17} /> Eliminar</button>}</div>{moveOpen && canManage && document.requirement_id && <div className="workflow-panel"><div className="workflow-people"><span><strong>Mover a carpeta</strong></span><span>Solo cambia la ubicación. El archivo, sus versiones y su historial se conservan.</span></div><label className="field"><span>Destino</span><select value={moveFolderId} onChange={(e) => setMoveFolderId(e.target.value)}><option value="">Raíz del requisito</option>{folderOptions.map((folder) => <option key={folder.id} value={folder.id}>{'— '.repeat(folder.depth)}{folder.name}</option>)}</select></label><div className="drawer-actions"><button className="secondary-button" type="button" onClick={() => { setMoveOpen(false); setMoveFolderId(document.folder_id || '') }}>Cancelar</button><button className="primary-button" type="button" onClick={handleMove} disabled={saving || (document.folder_id || '') === moveFolderId}><Folder size={16} /> {saving ? 'Moviendo…' : 'Mover documento'}</button></div></div>}</section>
      {error && <div className="form-error" role="alert">{error}</div>}

      <section className="drawer-section"><div className="drawer-section-heading"><div><span>FLUJO FORMAL</span><h3>Revisión y aprobación</h3></div></div>
        {document.status === 'draft' && canManage ? <div className="workflow-panel"><div className="form-grid two-cols"><label className="field"><span>Revisor *</span><select value={reviewerId} onChange={(e) => { const next = e.target.value; setReviewerId(next); if (!emailRecipientId) setEmailRecipientId(next) }}><option value="">Seleccionar</option>{members.map(({ user: m }) => <option key={m.id} value={m.id}>{personLabel(m)}</option>)}</select></label><label className="field"><span>Aprobador *</span><select value={approverId} onChange={(e) => setApproverId(e.target.value)}><option value="">Seleccionar</option>{members.map(({ user: m }) => <option key={m.id} value={m.id}>{personLabel(m)}</option>)}</select></label><label className="field"><span>Fecha objetivo</span><input type="date" value={reviewDueAt} onChange={(e) => setReviewDueAt(e.target.value)} /></label><label className="field field-wide"><span>Nota de envío</span><textarea rows={2} value={workflowComment} onChange={(e) => setWorkflowComment(e.target.value)} placeholder="Escribí una indicación para el revisor…" /></label><label className="field field-wide review-email-recipient"><span>Enviar correo a *</span><select value={emailRecipientId} onChange={(e) => { setEmailRecipientId(e.target.value); setEmailDelivery(null) }}><option value="">Seleccionar destinatario</option>{members.map(({ user: m }) => <option key={m.id} value={m.id}>{personLabel(m)}{m.email ? ` · ${m.email}` : ''}</option>)}</select></label></div><p className="workflow-recipient-note">{reviewerId && approverId && emailRecipientId ? <>La revisión queda asignada a <strong>{personLabel(selectedReviewer)}</strong>. El correo se enviará a <strong>{personLabel(selectedEmailRecipient)}</strong>{selectedEmailRecipient?.email ? ` (${selectedEmailRecipient.email})` : ''}. <strong>{personLabel(selectedApprover)}</strong> queda como aprobador.</> : 'Elegí revisor, aprobador y destinatario del correo para habilitar el envío.'}</p><button className="primary-button" disabled={!reviewerId || !approverId || !emailRecipientId || saving || emailSending} onClick={handleSubmitForReview}><Send size={16} /> {saving ? 'Enviando…' : 'Enviar a revisión y correo'}</button></div> : null}
        {document.status === 'in_progress' ? <div className="workflow-panel"><div className="workflow-people"><span>Revisor: <strong>{personLabel(document.reviewer)}</strong>{document.reviewed_at ? ` · revisado ${formatDateTime(document.reviewed_at)}` : ' · pendiente'}</span><span>Aprobador: <strong>{personLabel(document.approver)}</strong></span></div><textarea rows={2} value={workflowComment} onChange={(e) => setWorkflowComment(e.target.value)} placeholder="Comentario de revisión / aprobación…" /> <div className="drawer-actions">{canReview && !document.reviewed_at && <button className="secondary-button" onClick={() => runChange(() => reviewDocument(documentId, workflowComment))} disabled={saving}><CheckCircle2 size={16} /> Registrar revisión</button>}{canApprove && <button className="primary-button" onClick={() => runChange(() => approveDocument(documentId, workflowComment))} disabled={saving}><CheckCircle2 size={16} /> Aprobar documento</button>}{canReject && <button className="danger-button" onClick={() => runChange(() => rejectDocument(documentId, workflowComment))} disabled={!workflowComment.trim() || saving}><RotateCcw size={16} /> Solicitar cambios</button>}</div>{canSendReviewEmail && <div className="review-email-panel"><div className="review-email-heading"><Mail size={17} /><div><strong>Correo de revisión</strong><span>Podés enviarlo o reenviarlo a cualquier usuario activo de esta empresa.</span></div></div><label className="field"><span>Enviar correo a</span><select value={emailRecipientId} onChange={(e) => { setEmailRecipientId(e.target.value); setEmailDelivery(null) }}><option value="">Seleccionar destinatario</option>{members.map(({ user: m }) => <option key={m.id} value={m.id}>{personLabel(m)}{m.email ? ` · ${m.email}` : ''}</option>)}</select></label><button className="secondary-button" type="button" onClick={handleSendReviewEmail} disabled={!emailRecipientId || emailSending}><Mail size={16} /> {emailSending ? 'Enviando…' : 'Enviar correo'}</button></div>}</div> : null}
        {document.status === 'approved' && <div className="workflow-approved"><CheckCircle2 size={20} /><span>Aprobado {formatDateTime(document.approved_at)} · documento vigente y bloqueado para edición.</span></div>}
        {emailDelivery && <div className={`email-delivery-status ${emailDelivery.delivered ? 'delivered' : emailDelivery.failed ? 'failed' : 'pending'}`}><div><strong>{emailStatusLabel(emailDelivery.status)}</strong><span>{emailDelivery.recipientName}{emailDelivery.recipientEmail ? ` · ${emailDelivery.recipientEmail}` : ''}</span></div>{!emailDelivery.delivered && !emailDelivery.failed && <button className="text-action" type="button" onClick={() => checkEmailDelivery(emailDelivery.emailId)}><RefreshCw size={14} /> Comprobar entrega</button>}</div>}
      </section>

      <section className="drawer-section"><div className="drawer-section-heading"><div><span>INFORMACIÓN</span><h3>Clasificación y responsables</h3></div>{canManage && document.status !== 'approved' && !editMode && <button className="text-action" onClick={() => setEditMode(true)}><Pencil size={15} /> Editar</button>}</div>
        {editMode ? <form className="detail-edit-form" onSubmit={handleMetadataSave}><label className="field field-wide"><span>Título</span><input value={editValues.title} onChange={(e) => setEditValues(v => ({...v,title:e.target.value}))} required /></label><label className="field"><span>Tipo</span><select value={editValues.documentType} onChange={(e) => setEditValues(v => ({...v,documentType:e.target.value}))}>{DOCUMENT_TYPE_OPTIONS.map(i => <option key={i}>{i}</option>)}</select></label><label className="field"><span>Norma</span><select value={editValues.norm} onChange={(e) => setEditValues(v => ({...v,norm:e.target.value, requirementId:'', folderId:''}))}>{NORM_OPTIONS.map(i => <option key={i}>{i}</option>)}</select></label><label className="field field-wide"><span>Requisito ISO</span><select value={editValues.requirementId} onChange={(e) => setEditValues(v => ({...v,requirementId:e.target.value, folderId:''}))}><option value="">Sin requisito</option>{visibleRequirements.map(r => <option key={r.id} value={r.id}>Cap. {r.chapter} · {r.title}</option>)}</select></label><label className="field"><span>Módulo</span><select value={editValues.moduleId} onChange={(e) => setEditValues(v => ({...v,moduleId:e.target.value}))}><option value="">General</option>{modules.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label className="field"><span>Responsable</span><select value={editValues.responsibleId} onChange={(e) => setEditValues(v => ({...v,responsibleId:e.target.value}))}><option value="">Sin asignar</option>{members.map(({user:m}) => <option key={m.id} value={m.id}>{personLabel(m)}</option>)}</select></label><label className="field"><span>Fecha objetivo</span><input type="date" value={editValues.reviewDueAt} onChange={(e) => setEditValues(v => ({...v,reviewDueAt:e.target.value}))} /></label><label className="field field-wide"><span>Descripción</span><textarea rows={3} value={editValues.description} onChange={(e) => setEditValues(v => ({...v,description:e.target.value}))} /></label><div className="detail-edit-actions field-wide"><button className="secondary-button" type="button" onClick={() => setEditMode(false)}>Cancelar</button><button className="primary-button" disabled={saving}><Save size={16} /> Guardar</button></div></form> : <dl className="metadata-grid"><div><dt>Norma</dt><dd>{document.norm || 'General'}</dd></div><div><dt>Requisito</dt><dd>{document.requirement ? `Cap. ${document.requirement.chapter} · ${document.requirement.title}` : 'Sin requisito'}</dd></div><div><dt>Carpeta</dt><dd>{document.requirement_id ? (currentFolder?.name || 'Raíz del requisito') : 'Sin requisito'}</dd></div><div><dt>Responsable</dt><dd>{document.responsible ? personLabel(document.responsible) : 'Sin asignar'}</dd></div><div><dt>Fecha objetivo</dt><dd>{formatDateTime(document.review_due_at)}</dd></div><div><dt>Creado por</dt><dd>{personLabel(document.creator)}</dd></div><div><dt>Versión actual</dt><dd>v{document.current_version}</dd></div></dl>}
      </section>

      <section className="drawer-section"><div className="drawer-section-heading"><div><span>VERSIONES</span><h3>Historial de archivos</h3></div></div>{canManage && document.status !== 'approved' && <form className="version-upload" onSubmit={handleVersion}><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp" onChange={(e) => setVersionFile(e.target.files?.[0] || null)} /><input value={versionComment} onChange={(e) => setVersionComment(e.target.value)} placeholder="Comentario de la versión" /><button className="secondary-button" disabled={!versionFile || saving}><FilePlus2 size={16} /> Nueva versión</button></form>}<div className="version-list">{detail.versions.map(v => <button key={v.id} onClick={() => openDocumentFile(v.file_path)}><strong>v{v.version_number} · {v.file_name}</strong><span>{personLabel(v.creator)} · {formatDateTime(v.created_at)}{v.comment ? ` · ${v.comment}` : ''}</span></button>)}</div></section>

      <section className="drawer-section"><div className="drawer-section-heading"><div><span>OBSERVACIONES</span><h3>Seguimiento</h3></div></div><form className="comment-form" onSubmit={handleComment}><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} /><button className="primary-button" disabled={!comment.trim() || saving}><MessageSquarePlus size={16} /> Guardar observación</button></form><div className="comments-list">{detail.comments.map(i => <article className="comment-item" key={i.id}><div className="comment-avatar">{personLabel(i.author).charAt(0).toUpperCase()}</div><div><div className="comment-meta"><strong>{personLabel(i.author)}</strong><span>{formatDateTime(i.created_at)}</span></div><p>{i.comment}</p></div></article>)}</div></section>
      <section className="drawer-section"><div className="drawer-section-heading"><div><span>TRAZABILIDAD</span><h3>Historial</h3></div></div><div className="activity-list">{detail.activity.map(i => <div className="activity-item" key={i.id}><span className="activity-dot" /><div><strong>{activityCopy(i)}</strong><p>{personLabel(i.actor)} · {formatDateTime(i.created_at)}</p>{i.details?.recipient_email && <p>{i.details.recipient_name || 'Destinatario'} · {i.details.recipient_email}</p>}{i.details?.to && !i.details?.recipient_email && <p>{i.details.to}</p>}{i.details?.comment && <p>{i.details.comment}</p>}</div></div>)}</div></section>
    </div> : null}
  </aside></div>
}
