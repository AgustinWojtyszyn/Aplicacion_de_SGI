import { FileUp, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DOCUMENT_TYPE_OPTIONS, NORM_OPTIONS } from '../lib/constants'
import { createDocument, listCompanyMembers, validateDocumentFile } from '../services/documentService'
import { useAuth } from '../context/AuthContext'

const initialValues = {
  title: '',
  description: '',
  documentType: 'Procedimiento',
  norm: 'General',
  moduleId: '',
  responsibleId: '',
}

export default function DocumentFormModal({ open, onClose, onCreated }) {
  const { company, user, modules } = useAuth()
  const [values, setValues] = useState(initialValues)
  const [file, setFile] = useState(null)
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = useMemo(
    () => values.title.trim() && values.documentType && file && !submitting,
    [values.title, values.documentType, file, submitting],
  )

  useEffect(() => {
    if (!open || !company?.id) return
    let active = true
    setLoadingMembers(true)
    listCompanyMembers(company.id)
      .then((data) => active && setMembers(data))
      .catch((memberError) => active && setError(memberError.message))
      .finally(() => active && setLoadingMembers(false))
    return () => { active = false }
  }, [open, company?.id])

  useEffect(() => {
    if (!open) {
      setValues(initialValues)
      setFile(null)
      setError('')
    }
  }, [open])

  if (!open) return null

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setError('')
  }

  function handleFileChange(event) {
    const nextFile = event.target.files?.[0] || null
    try {
      if (nextFile) validateDocumentFile(nextFile)
      setFile(nextFile)
      setError('')
    } catch (fileError) {
      event.target.value = ''
      setFile(null)
      setError(fileError.message)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    try {
      await createDocument({
        companyId: company.id,
        userId: user.id,
        values,
        file,
      })
      onCreated?.()
      onClose()
    } catch (submitError) {
      console.error(submitError)
      setError(submitError.message || 'No se pudo cargar el documento.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" onClick={onClose} aria-label="Cerrar" />
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-document-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">NUEVO DOCUMENTO</p>
            <h2 id="new-document-title">Cargar documentación</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar formulario"><X size={20} /></button>
        </header>

        <form className="document-form" onSubmit={handleSubmit}>
          <div className="form-grid two-cols">
            <label className="field field-wide">
              <span>Título *</span>
              <input
                value={values.title}
                onChange={(event) => updateField('title', event.target.value)}
                maxLength={160}
                placeholder="Ej. Procedimiento de control de proveedores"
                required
              />
            </label>

            <label className="field">
              <span>Tipo de documento *</span>
              <select value={values.documentType} onChange={(event) => updateField('documentType', event.target.value)}>
                {DOCUMENT_TYPE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Norma / clasificación</span>
              <select value={values.norm} onChange={(event) => updateField('norm', event.target.value)}>
                {NORM_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Módulo</span>
              <select value={values.moduleId} onChange={(event) => updateField('moduleId', event.target.value)}>
                <option value="">Sin módulo específico</option>
                {modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Responsable</span>
              <select
                value={values.responsibleId}
                onChange={(event) => updateField('responsibleId', event.target.value)}
                disabled={loadingMembers}
              >
                <option value="">Sin asignar</option>
                {members.map(({ user: member }) => (
                  <option key={member.id} value={member.id}>{member.full_name || member.email}</option>
                ))}
              </select>
            </label>

            <label className="field field-wide">
              <span>Descripción</span>
              <textarea
                value={values.description}
                onChange={(event) => updateField('description', event.target.value)}
                rows={4}
                placeholder="Objetivo, alcance o una referencia breve del documento…"
              />
            </label>

            <label className="file-drop field-wide">
              <FileUp size={24} />
              <strong>{file ? file.name : 'Seleccionar archivo'}</strong>
              <span>PDF, Word, Excel, JPG, PNG o WEBP · máximo 25 MB</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                required
              />
            </label>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <footer className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={!canSubmit}>
              {submitting ? 'Cargando…' : 'Crear en borrador'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
