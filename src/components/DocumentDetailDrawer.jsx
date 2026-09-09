import { Download, FileText, MessageSquarePlus, Pencil, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DOCUMENT_STATUSES, DOCUMENT_TYPE_OPTIONS, NORM_OPTIONS } from '../lib/constants'
import { useAuth } from '../context/AuthContext'
import { canDeleteDocument, canManageDocument } from '../lib/permissions'
import {
  addDocumentComment,
  deleteDocument,
  getDocumentDetail,
  listCompanyMembers,
  openDocumentFile,
  updateDocumentMetadata,
  updateDocumentStatus,
} from '../services/documentService'
import StatusBadge from './StatusBadge'

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function personLabel(person) {
  return person?.full_name || person?.email || 'Usuario'
}

function activityCopy(item) {
  if (item.action === 'created') return 'Creó el documento'
  if (item.action === 'status_changed') {
    const from = DOCUMENT_STATUSES[item.from_status]?.label || item.from_status
    const to = DOCUMENT_STATUSES[item.to_status]?.label || item.to_status
    return `Cambió el estado de ${from} a ${to}`
  }
  if (item.action === 'responsible_changed') return 'Cambió el responsable'
  if (item.action === 'metadata_updated') return 'Actualizó los datos del documento'
  return 'Actualizó el documento'
}

export default function DocumentDetailDrawer({ documentId, onClose, onChanged }) {
  const { company, user, modules, role } = useAuth()
  const [detail, setDetail] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editValues, setEditValues] = useState(null)

  const document = detail?.document
  const nextStatus = useMemo(() => {
    if (document?.status === 'draft') return 'in_progress'
    if (document?.status === 'in_progress') return 'approved'
    return null
  }, [document?.status])

  const canManage = canManageDocument({ role, userId: user?.id, document })
  const canDelete = canDeleteDocument({ role, userId: user?.id, document })

  async function load() {
    if (!documentId) return
    setLoading(true)
    setError('')
    try {
      const [nextDetail, nextMembers] = await Promise.all([
        getDocumentDetail(documentId),
        listCompanyMembers(company.id),
      ])
      setDetail(nextDetail)
      setMembers(nextMembers)
      setEditValues({
        title: nextDetail.document.title,
        description: nextDetail.document.description || '',
        documentType: nextDetail.document.document_type,
        norm: nextDetail.document.norm || 'General',
        moduleId: nextDetail.document.module_id || '',
        responsibleId: nextDetail.document.responsible_id || '',
      })
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'No se pudo cargar el detalle del documento.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    setEditMode(false)
    setComment('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  if (!documentId) return null

  async function runChange(action) {
    setSaving(true)
    setError('')
    try {
      await action()
      await load()
      onChanged?.()
    } catch (changeError) {
      console.error(changeError)
      setError(changeError.message || 'No se pudo guardar el cambio.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange() {
    if (!nextStatus || !canManage) return
    await runChange(() => updateDocumentStatus(documentId, nextStatus))
  }

  async function handleMetadataSave(event) {
    event.preventDefault()
    if (!canManage) return
    await runChange(() => updateDocumentMetadata(documentId, editValues))
    setEditMode(false)
  }

  async function handleComment(event) {
    event.preventDefault()
    await runChange(() => addDocumentComment({ documentId, authorId: user.id, comment }))
    setComment('')
  }

  async function handleDelete() {
    if (!document || !canDelete || saving) return

    const confirmed = window.confirm(
      `¿Eliminar "${document.title}"?\n\nEsta acción elimina el registro, sus observaciones y el archivo asociado. No se puede deshacer.`,
    )
    if (!confirmed) return

    setSaving(true)
    setError('')
    try {
      await deleteDocument({ documentId: document.id, filePath: document.file_path })
      onChanged?.()
      onClose?.()
    } catch (deleteError) {
      console.error(deleteError)
      setError(deleteError.message || 'No se pudo eliminar el documento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar detalle" />
      <aside className="document-drawer" role="dialog" aria-modal="true" aria-label="Detalle del documento">
        <header className="drawer-header">
          <div>
            <p className="eyebrow">DETALLE DOCUMENTAL</p>
            <div className="drawer-title-row">
              <FileText size={20} />
              <h2>{document?.title || 'Documento'}</h2>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>

        {loading && !detail ? (
          <div className="drawer-loading"><span className="loader-dot" /><p>Cargando detalle…</p></div>
        ) : error && !detail ? (
          <div className="drawer-loading"><div className="form-error">{error}</div></div>
        ) : document ? (
          <div className="drawer-body">
            <section className="drawer-summary">
              <div className="drawer-status-row">
                <StatusBadge status={document.status} />
                <span>Actualizado {formatDateTime(document.updated_at)}</span>
              </div>
              <p>{document.description || 'Sin descripción adicional.'}</p>
              <div className="drawer-actions">
                <button className="secondary-button" onClick={() => openDocumentFile(document.file_path)}>
                  <Download size={17} /> Abrir archivo
                </button>
                {nextStatus && canManage && (
                  <button className="primary-button" onClick={handleStatusChange} disabled={saving}>
                    {nextStatus === 'in_progress' ? 'Enviar a proceso' : 'Marcar aprobado'}
                  </button>
                )}
                {canDelete && (
                  <button className="danger-button" onClick={handleDelete} disabled={saving}>
                    <Trash2 size={17} /> {saving ? 'Procesando…' : 'Eliminar documento'}
                  </button>
                )}
              </div>
            </section>

            {error && <div className="form-error" role="alert">{error}</div>}

            <section className="drawer-section">
              <div className="drawer-section-heading">
                <div><span>INFORMACIÓN</span><h3>Datos del documento</h3></div>
                {canManage && document.status !== 'approved' && !editMode && (
                  <button className="text-action" onClick={() => setEditMode(true)}><Pencil size={15} /> Editar</button>
                )}
              </div>

              {editMode ? (
                <form className="detail-edit-form" onSubmit={handleMetadataSave}>
                  <label className="field field-wide"><span>Título</span><input value={editValues.title} onChange={(e) => setEditValues((v) => ({ ...v, title: e.target.value }))} required /></label>
                  <label className="field"><span>Tipo</span><select value={editValues.documentType} onChange={(e) => setEditValues((v) => ({ ...v, documentType: e.target.value }))}>{DOCUMENT_TYPE_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="field"><span>Norma</span><select value={editValues.norm} onChange={(e) => setEditValues((v) => ({ ...v, norm: e.target.value }))}>{NORM_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="field"><span>Módulo</span><select value={editValues.moduleId} onChange={(e) => setEditValues((v) => ({ ...v, moduleId: e.target.value }))}><option value="">General</option>{modules.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  <label className="field"><span>Responsable</span><select value={editValues.responsibleId} onChange={(e) => setEditValues((v) => ({ ...v, responsibleId: e.target.value }))}><option value="">Sin asignar</option>{members.map(({ user: member }) => <option key={member.id} value={member.id}>{personLabel(member)}</option>)}</select></label>
                  <label className="field field-wide"><span>Descripción</span><textarea rows={3} value={editValues.description} onChange={(e) => setEditValues((v) => ({ ...v, description: e.target.value }))} /></label>
                  <div className="detail-edit-actions field-wide"><button className="secondary-button" type="button" onClick={() => setEditMode(false)}>Cancelar</button><button className="primary-button" disabled={saving}><Save size={16} /> Guardar</button></div>
                </form>
              ) : (
                <dl className="metadata-grid">
                  <div><dt>Tipo</dt><dd>{document.document_type}</dd></div>
                  <div><dt>Norma</dt><dd>{document.norm || 'General'}</dd></div>
                  <div><dt>Módulo</dt><dd>{document.module?.name || 'General'}</dd></div>
                  <div><dt>Responsable</dt><dd>{document.responsible ? personLabel(document.responsible) : 'Sin asignar'}</dd></div>
                  <div><dt>Creado por</dt><dd>{personLabel(document.creator)}</dd></div>
                  <div><dt>Creación</dt><dd>{formatDateTime(document.created_at)}</dd></div>
                  <div className="metadata-wide"><dt>Archivo</dt><dd>{document.file_name}</dd></div>
                </dl>
              )}
            </section>

            <section className="drawer-section">
              <div className="drawer-section-heading"><div><span>OBSERVACIONES</span><h3>Seguimiento</h3></div></div>
              <form className="comment-form" onSubmit={handleComment}>
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Agregar una observación para el equipo…" rows={3} maxLength={2000} />
                <button className="primary-button" disabled={!comment.trim() || saving}><MessageSquarePlus size={16} /> Guardar observación</button>
              </form>
              <div className="comments-list">
                {detail.comments.length === 0 ? <p className="detail-empty-copy">Todavía no hay observaciones.</p> : detail.comments.map((item) => (
                  <article className="comment-item" key={item.id}>
                    <div className="comment-avatar">{personLabel(item.author).charAt(0).toUpperCase()}</div>
                    <div><div className="comment-meta"><strong>{personLabel(item.author)}</strong><span>{formatDateTime(item.created_at)}</span></div><p>{item.comment}</p></div>
                  </article>
                ))}
              </div>
            </section>

            <section className="drawer-section">
              <div className="drawer-section-heading"><div><span>HISTORIAL</span><h3>Actividad</h3></div></div>
              <div className="activity-list">
                {detail.activity.length === 0 ? <p className="detail-empty-copy">Sin actividad registrada.</p> : detail.activity.map((item) => (
                  <div className="activity-item" key={item.id}>
                    <span className="activity-dot" />
                    <div><strong>{activityCopy(item)}</strong><p>{personLabel(item.actor)} · {formatDateTime(item.created_at)}</p></div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
