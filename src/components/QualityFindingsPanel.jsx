import { AlertCircle, Camera, CheckCircle2, Clock3, ExternalLink } from 'lucide-react'

export const FOLLOWUP_CATEGORIES = [
  'HIGIENE Y PRÁCTICAS SANITARIAS', 'CARTELERÍA', 'ALMACENAMIENTO',
  'REGISTROS', 'MANTENIMIENTO', 'INVENTARIO',
]
export function inferFollowupCategory(item) {
  if ([49, 50].includes(item?.item_number)) return 'INVENTARIO'
  if (item?.item_number === 48) return 'CARTELERÍA'
  const section = item?.section || ''
  if (section === 'ALMACENAMIENTO') return 'ALMACENAMIENTO'
  if (section === 'REGISTROS') return 'REGISTROS'
  if (section === 'MANTENIMIENTO') return 'MANTENIMIENTO'
  return 'HIGIENE Y PRÁCTICAS SANITARIAS'
}

const followupOptions = [
  ['open', 'Pendiente'], ['in_progress', 'En proceso'], ['closed', 'Cumplido'],
]
const severityLabels = { non_complies: 'NO CUMPLE', partial: 'CUMPLE PARCIAL' }

export default function QualityFindingsPanel({
  template, answers, savedItems, canEdit, savingItem, inspection,
  onChange, onSave, onAttachEvidence, onShowEvidence,
}) {
  const findings = template
    .filter((item) => savedItems.includes(item.item_number))
    .filter((item) => ['non_complies', 'partial'].includes(answers[item.item_number]?.result))
  const pending = findings.filter((item) => answers[item.item_number]?.followupStatus !== 'closed').length
  const closed = findings.length - pending

  return <section className="quality-followup" aria-label="Hallazgos y seguimiento">
    <div className="quality-followup-summary">
      <div><AlertCircle size={20}/><strong>{findings.length}</strong><span>Hallazgos registrados</span></div>
      <div><Clock3 size={20}/><strong>{pending}</strong><span>Pendientes de mejora</span></div>
      <div><CheckCircle2 size={20}/><strong>{closed}</strong><span>Acciones cumplidas</span></div>
    </div>
    <p className="quality-help">Esta vista reúne los puntos con incumplimientos de la inspección y permite documentar las acciones, su estado y las fotos del antes/después. Los puntos conformes o no aplicables no generan hallazgos.</p>
    {findings.length === 0 ? <div className="quality-empty-findings">
      <CheckCircle2 size={28}/>
      <strong>Todavía no hay hallazgos registrados</strong>
      <p>Los controles marcados como “No cumple” o “Cumple parcial” y guardados en Inspecciones BPM aparecerán acá.</p>
    </div> : FOLLOWUP_CATEGORIES.map((category) => {
      const categoryItems = findings.filter((item) =>
        (answers[item.item_number]?.followupCategory || inferFollowupCategory(item)) === category)
      if (!categoryItems.length) return null
      return <section className="quality-followup-group" key={category}>
        <h3>{category} <small>{categoryItems.length}</small></h3>
        {categoryItems.map((item) => {
          const answer = answers[item.item_number] || {}
          const busy = savingItem === item.item_number
          const disabled = busy || !canEdit
          return <article className="quality-finding-card" key={item.item_number}>
            <div className="quality-finding-head">
              <strong>Ítem {item.item_number}: {item.question}</strong>
              <span className={`quality-result-chip ${answer.result === 'partial' ? 'quality-result-partial' : 'quality-result-fail'}`}>
                {severityLabels[answer.result]}
              </span>
            </div>
            <div className="quality-finding-grid">
              <label className="quality-field quality-field-wide">HALLAZGO DETECTADO
                <textarea rows={2} disabled value={answer.comments || ''} aria-label={`Hallazgo original del ítem ${item.item_number}`} />
              </label>
              <label className="quality-field quality-field-wide">ACCIÓN CORRECTIVA
                <textarea rows={2} disabled={disabled} value={answer.correctiveAction || ''}
                  placeholder="Acción acordada y cómo se resolverá"
                  onChange={(e) => onChange(item.item_number, { correctiveAction: e.target.value })} />
              </label>
              <label className="quality-field">CATEGORÍA
                <select disabled={disabled}
                  value={answer.followupCategory || inferFollowupCategory(item)}
                  onChange={(e) => onChange(item.item_number, { followupCategory: e.target.value })}>
                  {FOLLOWUP_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="quality-field">ESTADO DE LA MEJORA
                <select disabled={disabled} value={answer.followupStatus || 'open'}
                  onChange={(e) => onChange(item.item_number, { followupStatus: e.target.value })}>
                  {followupOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="quality-field">FECHA OBJETIVO
                <input type="date" disabled={disabled} value={answer.dueDate || ''}
                  onChange={(e) => onChange(item.item_number, { dueDate: e.target.value })}/>
              </label>
            </div>
            <div className="quality-finding-actions">
              <div className="quality-evidence-pair">
                {['before','after'].map((stage) => {
                  const path = stage === 'before' ? answer.evidenceBefore : answer.evidenceAfter
                  const originalLocked = inspection.status === 'closed' && stage === 'before'
                  const photoLabel = stage === 'before' ? 'ANTES' : 'DESPUÉS'
                  return <div className="quality-evidence-slot" key={stage}>
                    <strong>{photoLabel}</strong>
                    {path && <button className="quality-photo-view" type="button" onClick={() => onShowEvidence(path)}>
                      <ExternalLink size={14}/> Ver foto
                    </button>}
                    {canEdit && !originalLocked &&
                      <label className="quality-photo-label"><Camera size={14}/> {path ? 'Cambiar' : 'Agregar foto'}
                        <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={disabled}
                          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; onAttachEvidence(item.item_number, stage, file) }} />
                      </label>}
                    {!path && !canEdit && <small>Sin evidencia</small>}
                  </div>
                })}
              </div>
              {canEdit && <button className="primary-button" type="button" disabled={disabled}
                onClick={() => onSave(item.item_number)}>{busy ? 'Guardando…' : 'Guardar seguimiento'}</button>}
            </div>
          </article>
        })}
      </section>
    })}
  </section>
}
