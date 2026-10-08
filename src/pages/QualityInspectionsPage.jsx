import { ClipboardCheck, Plus, QrCode, Camera, CheckCircle2, RefreshCw, Printer, CalendarDays, ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { APP_URL } from '../lib/constants'
import qrcode from '../vendor/qrcode-generator.mjs'
import {
  canManageInspections, closeQualityInspection, createQualityInspection, createQualitySite,
  getQualityEvidenceUrl, getQualityInspection, inspectionCode, listQualityActivity,
  listQualityAnswers, listQualityInspections, listQualitySites, listQualityTemplate,
  qualityScore, saveQualityAnswer, uploadQualityEvidence,
} from '../services/qualityService'

function todayLocal() {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
const resultOptions = [
  ['','Sin evaluar'], ['complies','Cumple'], ['non_complies','No cumple'],
  ['partial','Cumple parcial'], ['na','No aplica'],
]
const progressOptions = [['open','Pendiente'],['in_progress','En proceso'],['closed','Cumplido']]
function emptyAnswer() {
  return { result: '', comments: '', correctiveAction: '', followupStatus: 'not_required',
    dueDate: '', evidenceBefore: '', evidenceAfter: '' }
}
function mapAnswer(row) {
  return {
    result: row.result || '', comments: row.comments || '',
    correctiveAction: row.corrective_action || '',
    followupStatus: row.followup_status || 'not_required',
    dueDate: row.due_date || '', evidenceBefore: row.evidence_before || '',
    evidenceAfter: row.evidence_after || '',
  }
}
function shortDate(value) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-AR') : '—'
}
function CentralQR({ url }) {
  const cells = useMemo(() => {
    if (!url) return null
    try {
      const code = qrcode(0, 'M')
      code.addData(url)
      code.make()
      const count = code.getModuleCount()
      const rects = []
      for (let y = 0; y < count; y += 1)
        for (let x = 0; x < count; x += 1)
          if (code.isDark(y, x)) rects.push(<rect key={`${x}-${y}`} x={x+4} y={y+4} width="1" height="1" />)
      return { count, rects }
    } catch {
      return null
    }
  }, [url])
  return (
    <div className="quality-qr-card" id="quality-site-qr">
      <div className="quality-qr-heading"><QrCode size={18} /> QR ÚNICO · AUDITORÍAS</div>
      {cells && <svg className="quality-qr-image" viewBox={`0 0 ${cells.count+8} ${cells.count+8}`} shapeRendering="crispEdges"
        role="img" aria-label="Código QR único para el acceso a las auditorías">
        <rect width={cells.count+8} height={cells.count+8} fill="white" />
        <g fill="black">{cells.rects}</g>
      </svg>}
      <strong>Auditorías de comedores</strong>
      <p>Un único QR para todas las fábricas y todas las inspecciones. Quien ingresa ve los registros habilitados según su cuenta. No se generan QR por establecimiento.</p>
      <div className="quality-qr-actions">
        <button type="button" className="secondary-button" onClick={() => navigator.clipboard.writeText(url)}>Copiar enlace</button>
        <button type="button" className="secondary-button" onClick={() => window.print()}><Printer size={15} /> Imprimir QR</button>
      </div>
    </div>
  )
}

export default function QualityInspectionsPage() {
  const { company, role, profile } = useAuth()
  const canEdit = canManageInspections(role)
  const [sites, setSites] = useState([])
  const [siteId, setSiteId] = useState('')
  const [inspections, setInspections] = useState([])
  const [inspectionId, setInspectionId] = useState('')
  const [inspection, setInspection] = useState(null)
  const [template, setTemplate] = useState([])
  const [answers, setAnswers] = useState({})
  const [activity, setActivity] = useState([])
  const [newSiteName, setNewSiteName] = useState('')
  const [inspector, setInspector] = useState('')
  const [inspectionDate, setInspectionDate] = useState(todayLocal)
  const [savingItem, setSavingItem] = useState(null)
  const [working, setWorking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { setInspector(profile?.full_name || '') }, [profile?.full_name])
  useEffect(() => {
    let alive = true
    setError('')
    setInspectionId('')
    setInspection(null)
    setSites([])
    if (!company?.id) return undefined
    listQualitySites(company.id).then((list) => {
      if (!alive) return
      setSites(list)
      setSiteId('')
    }).catch((err) => { if (alive) setError(err.message) })
    return () => { alive = false }
  }, [company?.id])

  async function loadInspections(selectedSiteId = siteId) {
    if (!company?.id) { setInspections([]); return }
    setLoading(true)
    try {
      const data = await listQualityInspections(company.id, selectedSiteId)
      setInspections(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    setInspectionId('')
    setInspection(null)
    setAnswers({})
    loadInspections(siteId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, company?.id])

  async function openInspection(id) {
    setError('')
    setNotice('')
    setInspectionId(id)
    setLoading(true)
    try {
      const [detail, items, responses, log] = await Promise.all([
        getQualityInspection(company.id, id), listQualityTemplate(),
        listQualityAnswers(company.id, id), listQualityActivity(company.id, id),
      ])
      if (!sites.some((site) => site.id === detail.site_id)) throw new Error('La inspección no pertenece a una fábrica accesible.')
      const mapped = Object.fromEntries(responses.map((row) => [row.item_number, mapAnswer(row)]))
      setInspection(detail)
      setTemplate(items)
      setAnswers(mapped)
      setActivity(log)
    } catch (err) { setError(err.message); setInspection(null) }
    finally { setLoading(false) }
  }
  const activeSite = sites.find((site) => site.id === siteId)
  const qrUrl = `${APP_URL}/inspections`
  const answered = Object.values(answers).filter((answer) => Boolean(answer.result))
  const score = qualityScore(answered)
  const required = template.length || 50
  const completion = Math.round(100 * answered.length / required)
  const grouped = useMemo(() => {
    const result = []
    template.forEach((item) => {
      let section = result[result.length - 1]
      if (!section || section.title !== item.section) {
        section = { title: item.section, items: [] }
        result.push(section)
      }
      section.items.push(item)
    })
    return result
  }, [template])

  function patchAnswer(itemNumber, fields) {
    setAnswers((prev) => ({ ...prev, [itemNumber]: { ...emptyAnswer(), ...prev[itemNumber], ...fields } }))
  }
  async function addSite(event) {
    event.preventDefault()
    setWorking(true); setError(''); setNotice('')
    try {
      const next = await createQualitySite(company.id, newSiteName)
      setSites((prev) => [...prev, { ...next, active: true }].sort((a,b) => a.name.localeCompare(b.name)))
      setSiteId(next.id); setNewSiteName('')
      setNotice('Establecimiento creado. Usará el mismo QR general de auditorías.')
    } catch (err) { setError(err.message) }
    finally { setWorking(false) }
  }
  async function addInspection(event) {
    event.preventDefault()
    if (!siteId) return
    setWorking(true); setError(''); setNotice('')
    try {
      const created = await createQualityInspection({
        companyId: company.id, siteId, inspectorName: inspector, inspectionDate,
      })
      await loadInspections()
      await openInspection(created.id)
      setNotice(`Inspección ${inspectionCode(created.inspection_number)} creada. Completá los 50 puntos y guardá cada respuesta.`)
    } catch (err) { setError(err.message) }
    finally { setWorking(false) }
  }
  async function persistAnswer(itemNumber) {
    const answer = { ...emptyAnswer(), ...answers[itemNumber] }
    if (!answer.result) { setError('Elegí primero el resultado del control.'); return }
    setSavingItem(itemNumber); setError(''); setNotice('')
    try {
      await saveQualityAnswer({
        companyId: company.id, inspectionId, itemNumber, ...answer,
        evidenceBefore: answer.evidenceBefore, evidenceAfter: answer.evidenceAfter,
      })
      setNotice(`Punto ${itemNumber} guardado.`)
      setActivity(await listQualityActivity(company.id, inspectionId))
    } catch (err) { setError(err.message) }
    finally { setSavingItem(null) }
  }
  async function attachEvidence(itemNumber, stage, file) {
    if (!file) return
    const answer = { ...emptyAnswer(), ...answers[itemNumber] }
    if (!answer.result) { setError('Primero elegí y guardá el resultado del punto.'); return }
    setSavingItem(itemNumber); setError(''); setNotice('')
    try {
      const path = await uploadQualityEvidence(company.id, inspectionId, itemNumber, stage, file)
      const patch = stage === 'before' ? { evidenceBefore: path } : { evidenceAfter: path }
      await saveQualityAnswer({ companyId: company.id, inspectionId, itemNumber, ...answer, ...patch })
      patchAnswer(itemNumber, patch)
      setNotice('Fotografía almacenada de forma privada.')
      setActivity(await listQualityActivity(company.id, inspectionId))
    } catch (err) { setError(err.message) }
    finally { setSavingItem(null) }
  }
  async function showEvidence(path) {
    const popup = window.open('', '_blank')
    if (popup) popup.opener = null
    try {
      const url = await getQualityEvidenceUrl(path)
      if (popup) popup.location.href = url
      else window.location.assign(url)
    } catch (err) { popup?.close(); setError(err.message) }
  }
  async function finishInspection() {
    if (!window.confirm('¿Cerrar esta inspección? Las respuestas originales quedarán bloqueadas; el seguimiento de acciones seguirá habilitado.')) return
    setWorking(true); setError('')
    try {
      await closeQualityInspection(company.id, inspectionId)
      await openInspection(inspectionId)
      await loadInspections()
      setNotice('Inspección cerrada y registrada en el historial.')
    } catch (err) { setError(err.message) }
    finally { setWorking(false) }
  }

  return <section className="page-stack quality-page">
    <header className="page-heading quality-heading">
      <div><p className="eyebrow">CALIDAD · MEJORA CONTINUA</p><h1>Inspecciones de comedores</h1>
        <p>Checklist BPM P-07-R-06 · revisión solicitada 01 · observaciones y seguimiento por establecimiento.</p></div>
      <button className="secondary-button" onClick={() => loadInspections()}><RefreshCw size={16} /> Actualizar</button>
    </header>
    {error && <div className="page-error" role="alert">{error}</div>}
    {notice && <div className="page-success" role="status">{notice}</div>}
    <div className="quality-shell">
      <aside className="quality-sidebar">
        <div className="quality-panel">
          <h2>Establecimientos</h2>
          <label className="quality-field">Elegir comedor
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Todos los establecimientos</option>
              {sites.map((site) => <option value={site.id} key={site.id}>{site.name}{!site.active ? ' (inactivo)' : ''}</option>)}
            </select>
          </label>
          {canEdit && <form onSubmit={addSite} className="quality-add-site">
            <label className="quality-field">Nuevo establecimiento<input value={newSiteName} onChange={(e)=>setNewSiteName(e.target.value)} placeholder="Ej.: Planta 1 - comedor" maxLength={160} required /></label>
            <button className="secondary-button" disabled={working}><Plus size={15} /> Agregar</button>
          </form>}
        </div>
        <CentralQR url={qrUrl} />
        <div className="quality-panel">
          <h2>Inspecciones {activeSite ? `· ${activeSite.name}` : '· Todas'}</h2>
          {canEdit && activeSite?.active && <form onSubmit={addInspection} className="quality-new-inspection">
            <label className="quality-field">Fecha<input type="date" value={inspectionDate} onChange={(e)=>setInspectionDate(e.target.value)} required /></label>
            <label className="quality-field">Inspector/a<input value={inspector} onChange={(e)=>setInspector(e.target.value)} minLength={2} required /></label>
            <button className="primary-button" disabled={working}><Plus size={16}/> Nueva inspección</button>
          </form>}
          {loading && <p>Cargando…</p>}
          <div className="quality-inspection-list">
            {inspections.length === 0 && <p className="quality-help">Todavía no hay inspecciones registradas.</p>}
            {inspections.map((item)=><button key={item.id} type="button"
              className={`quality-inspection-button ${inspectionId===item.id?'selected':''}`} onClick={()=>openInspection(item.id)}>
              <strong>{inspectionCode(item.inspection_number)}</strong>
              <span>{item.site?.name || 'Comedor'} · {shortDate(item.inspection_date)} · {item.status==='closed'?'Finalizada':'Borrador'}</span>
              <small>{item.inspector_name}</small>
            </button>)}
          </div>
        </div>
      </aside>
      <div className="quality-main">
        {!inspection && <div className="quality-panel quality-welcome">
          <ClipboardCheck size={36} />
          <h2>Seleccioná una inspección</h2>
          <p>Seleccioná una inspección del historial. Todas las fábricas y sus observaciones se consultan mediante el mismo QR central.</p>
        </div>}
        {inspection && <div className="quality-panel quality-inspection-detail">
          <div className="quality-detail-head">
            <div><p className="eyebrow">INSPECCIÓN {inspectionCode(inspection.inspection_number)}</p>
              <h2>{sites.find((site) => site.id === inspection.site_id)?.name || 'Comedor'}</h2>
              <p>{shortDate(inspection.inspection_date)} · {inspection.inspector_name} · {inspection.status==='closed'?'Cerrada':'En elaboración'}</p></div>
            {canEdit && inspection.status==='draft' &&
              <button className="primary-button" onClick={finishInspection} disabled={working||answered.length!==required}>
                <CheckCircle2 size={17}/> Cerrar inspección
              </button>}
          </div>
          <div className="quality-stats">
            <div><strong>{answered.length}/{required}</strong><span>Controles registrados</span></div>
            <div><strong>{completion}%</strong><span>Checklist completo</span></div>
            <div><strong>{score.percentage}%</strong><span>Cumplimiento (sin N/A)</span></div>
            <div><strong>{score.pending}</strong><span>Hallazgos pendientes</span></div>
          </div>
          {inspection.status==='draft' && <p className="quality-help">Las respuestas se guardan por punto. Para cerrar la inspección deben completarse los {required} controles.</p>}
          <div className="quality-checklist">
            {grouped.map((section)=><section key={section.title} className="quality-section">
              <h3>{section.title}</h3>
              {section.items.map((item)=>{
                const answer = { ...emptyAnswer(), ...answers[item.item_number] }
                const isFinding = ['non_complies','partial'].includes(answer.result)
                const originalLocked = inspection.status==='closed'
                const disabled = !canEdit || savingItem===item.item_number
                return <article key={item.item_number} className="quality-check-item">
                  <div className="quality-check-title"><span>{item.item_number}</span><strong>{item.question}</strong></div>
                  <div className="quality-check-fields">
                    <label className="quality-field">Resultado<select value={answer.result} disabled={disabled||originalLocked}
                      onChange={(e)=>{
                        const result=e.target.value
                        patchAnswer(item.item_number,{result,followupStatus:['non_complies','partial'].includes(result)?'open':'not_required'})
                      }}>
                      {resultOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
                    </select></label>
                    <label className="quality-field quality-field-wide">Observaciones<textarea rows={2} value={answer.comments}
                      disabled={disabled||originalLocked} onChange={(e)=>patchAnswer(item.item_number,{comments:e.target.value})}
                      placeholder="Descripción de lo observado" /></label>
                    {isFinding && <>
                      <label className="quality-field quality-field-wide">Acción correctiva<textarea rows={2} value={answer.correctiveAction}
                        disabled={disabled} onChange={(e)=>patchAnswer(item.item_number,{correctiveAction:e.target.value})}
                        placeholder="Qué se corregirá y cómo" /></label>
                      <label className="quality-field">Seguimiento<select value={answer.followupStatus} disabled={disabled}
                        onChange={(e)=>patchAnswer(item.item_number,{followupStatus:e.target.value})}>
                        {progressOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
                      </select></label>
                      <label className="quality-field">Fecha objetivo<input type="date" value={answer.dueDate} disabled={disabled}
                        onChange={(e)=>patchAnswer(item.item_number,{dueDate:e.target.value})}/></label>
                    </>}
                  </div>
                  <div className="quality-check-actions">
                    {canEdit && answer.result && <button type="button" className="secondary-button"
                      disabled={disabled} onClick={()=>persistAnswer(item.item_number)}>
                      {savingItem===item.item_number?'Guardando…':'Guardar punto'}
                    </button>}
                    {['before','after'].map((stage)=>{
                      const key=stage==='before'?'evidenceBefore':'evidenceAfter'
                      return <div key={stage} className="quality-evidence-action">
                        {canEdit && answer.result && <label className="quality-photo-label">
                          <Camera size={15}/> {stage==='before'?'Foto antes':'Foto después'}
                          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} hidden
                            onChange={(e)=>{const file=e.target.files?.[0];e.target.value='';attachEvidence(item.item_number,stage,file)}} />
                        </label>}
                        {answer[key] && <button type="button" className="quality-photo-view" onClick={()=>showEvidence(answer[key])}>
                          <ExternalLink size={14}/> Ver {stage==='before'?'antes':'después'}
                        </button>}
                      </div>
                    })}
                  </div>
                </article>
              })}
            </section>)}
          </div>
          <section className="quality-activity">
            <h3>Historial de modificaciones</h3>
            <p>Se registran altas y actualizaciones. Los resultados de una inspección cerrada no se pueden reescribir.</p>
            {activity.slice(0,10).map((a)=><div key={a.id}><CalendarDays size={14} /> {new Date(a.created_at).toLocaleString('es-AR')} · {a.action.replaceAll('_',' ')}</div>)}
          </section>
        </div>}
      </div>
    </div>
  </section>
}
