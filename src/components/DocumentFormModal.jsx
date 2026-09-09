import { FileUp, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DOCUMENT_TYPE_OPTIONS, NORM_OPTIONS } from '../lib/constants'
import { createDocument, listCompanyMembers, validateDocumentFile } from '../services/documentService'
import { listSgiRequirements } from '../services/sgiService'
import { useAuth } from '../context/AuthContext'

const initialValues = { title: '', description: '', documentType: 'Procedimiento', norm: 'General', moduleId: '', requirementId: '', responsibleId: '', reviewDueAt: '' }

export default function DocumentFormModal({ open, onClose, onCreated }) {
  const { company, user, modules } = useAuth()
  const [values, setValues] = useState(initialValues)
  const [file, setFile] = useState(null)
  const [members, setMembers] = useState([])
  const [requirements, setRequirements] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const canSubmit = useMemo(() => values.title.trim() && values.documentType && file && !submitting, [values.title, values.documentType, file, submitting])

  useEffect(() => {
    if (!open || !company?.id) return
    Promise.all([listCompanyMembers(company.id), listSgiRequirements(company.id)])
      .then(([nextMembers, nextRequirements]) => { setMembers(nextMembers); setRequirements(nextRequirements) })
      .catch((loadError) => setError(loadError.message))
  }, [open, company?.id])

  useEffect(() => { if (!open) { setValues(initialValues); setFile(null); setError('') } }, [open])
  if (!open) return null

  const visibleRequirements = requirements.filter((item) => values.norm !== 'General' && item.norm === values.norm)
  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value, ...(field === 'norm' ? { requirementId: '' } : {}) }))
    setError('')
  }
  function handleFileChange(event) {
    const nextFile = event.target.files?.[0] || null
    try { if (nextFile) validateDocumentFile(nextFile); setFile(nextFile); setError('') }
    catch (fileError) { event.target.value = ''; setFile(null); setError(fileError.message) }
  }
  async function handleSubmit(event) {
    event.preventDefault(); if (!canSubmit) return
    setSubmitting(true); setError('')
    try { await createDocument({ companyId: company.id, userId: user.id, values, file }); onCreated?.(); onClose() }
    catch (submitError) { console.error(submitError); setError(submitError.message || 'No se pudo cargar el documento.') }
    finally { setSubmitting(false) }
  }

  return <div className="modal-layer" role="presentation">
    <button className="modal-backdrop" onClick={onClose} aria-label="Cerrar" />
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-document-title">
      <header className="modal-header"><div><p className="eyebrow">NUEVO DOCUMENTO</p><h2 id="new-document-title">Cargar documentación</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar formulario"><X size={20} /></button></header>
      <form className="document-form" onSubmit={handleSubmit}><div className="form-grid two-cols">
        <label className="field field-wide"><span>Título *</span><input value={values.title} onChange={(e) => updateField('title', e.target.value)} maxLength={160} required /></label>
        <label className="field"><span>Tipo *</span><select value={values.documentType} onChange={(e) => updateField('documentType', e.target.value)}>{DOCUMENT_TYPE_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="field"><span>Norma</span><select value={values.norm} onChange={(e) => updateField('norm', e.target.value)}>{NORM_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="field field-wide"><span>Capítulo / requisito ISO</span><select value={values.requirementId} onChange={(e) => updateField('requirementId', e.target.value)} disabled={values.norm === 'General'}><option value="">Sin requisito específico</option>{visibleRequirements.map((r) => <option key={r.id} value={r.id}>Cap. {r.chapter} · {r.title}</option>)}</select></label>
        <label className="field"><span>Módulo</span><select value={values.moduleId} onChange={(e) => updateField('moduleId', e.target.value)}><option value="">Sin módulo específico</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label className="field"><span>Responsable</span><select value={values.responsibleId} onChange={(e) => updateField('responsibleId', e.target.value)}><option value="">Sin asignar</option>{members.map(({ user: member }) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}</select></label>
        <label className="field"><span>Fecha objetivo de revisión</span><input type="date" value={values.reviewDueAt} onChange={(e) => updateField('reviewDueAt', e.target.value)} /></label>
        <label className="field field-wide"><span>Descripción</span><textarea value={values.description} onChange={(e) => updateField('description', e.target.value)} rows={3} /></label>
        <label className="file-drop field-wide"><FileUp size={24} /><strong>{file ? file.name : 'Seleccionar archivo'}</strong><span>PDF, Word, Excel, JPG, PNG o WEBP · máximo 25 MB</span><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} required /></label>
      </div>{error && <div className="form-error" role="alert">{error}</div>}<footer className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit" disabled={!canSubmit}>{submitting ? 'Cargando…' : 'Crear en borrador'}</button></footer></form>
    </section>
  </div>
}
