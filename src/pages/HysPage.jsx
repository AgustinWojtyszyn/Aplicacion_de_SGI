import {
  Building2, CalendarDays, CheckCircle2, ClipboardList, Download, FilePlus2,
  FileText, History, LayoutDashboard, LockKeyhole, MapPin, Plus, RefreshCw,
  ShieldCheck, UploadCloud, Users, X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { GENERAL_CATEGORIES, HYS_ALL_SECTIONS, HYS_SECTIONS, HYS_PRIORITIES, HYS_STATES, sectionLabel } from '../lib/hysCatalog'
import {
  addHysUnit, canUseHys, createHysRecord, downloadActionsExcel, listHysHistory,
  loadHys, openHysFile, removeHysGrant, saveHysAction, saveHysGrant, setHysRecordObsolete, setHysOnly,
} from '../services/hysService'

const initial = { units: [], actions: [], records: [], grants: [], members: [] }
const emptyAction = { title: '', description: '', responsible: '', priority: 'media', status: 'pendiente', due_date: '', unitId: '' }
const emptyRecord = { title: '', notes: '', category: '', recorded_at: '', expires_at: '', supersedesId: '', versionNo: 1, actionId: '' }
const formatDate = (date) => date ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00')) : '—'
const errorText = (error) => {
  if (/hys_|hys-files|schema cache|could not find the table/i.test(error?.message || '')) {
    return 'El módulo de Higiene y Seguridad requiere aplicar su migración SQL en Supabase. ' + (error?.message || '')
  }
  return error?.message || 'Ocurrió un error al guardar los cambios.'
}

export default function HysPage() {
  const { company, user, role } = useAuth()
  const isAdmin = role === 'admin'
  const [data, setData] = useState(initial)
  const [view, setView] = useState('overview')
  const [unitId, setUnitId] = useState('')
  const [section, setSection] = useState('legal')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showUnit, setShowUnit] = useState(false)
  const [unitDraft, setUnitDraft] = useState({ name: '', kind: 'sede' })
  const [actionDraft, setActionDraft] = useState(null)
  const [editingAction, setEditingAction] = useState(null)
  const [recordDraft, setRecordDraft] = useState(null)
  const [recordFile, setRecordFile] = useState(null)
  const [grantDraft, setGrantDraft] = useState({ userId: '', section: 'actions', unitId: '', permission: 'read' })
  const [history, setHistory] = useState(null)

  const refresh = useCallback(async () => {
    if (!company?.id) return
    setLoading(true)
    try {
      const next = await loadHys({ companyId: company.id, isAdmin })
      setData(next)
      setError('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [company?.id, isAdmin])

  useEffect(() => { refresh() }, [refresh])

  const unitName = useCallback((id) => data.units.find((u) => u.id === id)?.name || 'Establecimiento', [data.units])
  const access = useCallback((code, id, write = false) =>
    canUseHys({ isAdmin, grants: data.grants, section: code, unitId: id || null, write }),
  [isAdmin, data.grants])

  const actions = useMemo(() => data.actions.filter((a) => !unitId || a.unit_id === unitId), [data.actions, unitId])
  const visibleRecords = data.records.filter((r) =>
    r.section === (view === 'general' ? 'general' : section) &&
    (r.unit_id || '') === (view === 'general' ? '' : unitId))
  const activeSection = view === 'general'
    ? HYS_ALL_SECTIONS[0]
    : HYS_SECTIONS.find((s) => s.code === section) || HYS_SECTIONS[0]
  const today = new Date().toISOString().slice(0, 10)
  const due = data.records.filter((r) => r.expires_at && r.expires_at < today && !r.is_obsolete).length
  const expiring = data.records.filter((r) => r.expires_at && !r.is_obsolete)
  const valid = expiring.filter((r) => r.expires_at >= today).length
  const pending = data.actions.filter((a) => !['verificada', 'resuelta'].includes(a.status))
  const completed = data.actions.filter((a) => a.status === 'verificada').length
  const canAddAction = access('actions', null, true) || data.units.some((u) => access('actions', u.id, true))

  const go = (nextView, nextUnitId = '') => {
    setView(nextView)
    setUnitId(nextUnitId)
    setError('')
    setNotice('')
    if (nextView === 'unit') setSection('legal')
  }

  async function run(operation, success) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await operation()
      setNotice(success)
      await refresh()
      return true
    } catch (e) {
      setError(errorText(e))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function createUnit(e) {
    e.preventDefault()
    const ok = await run(() => addHysUnit({ companyId: company.id, ...unitDraft }), 'Establecimiento creado.')
    if (ok) { setShowUnit(false); setUnitDraft({ name: '', kind: 'sede' }) }
  }

  function newAction(action = null) {
    setEditingAction(action)
    const firstEditableUnit = data.units.find((u) => access('actions', u.id, true))?.id || ''
    setActionDraft(action
      ? { title: action.title, description: action.description, responsible: action.responsible,
        priority: action.priority, status: action.status, due_date: action.due_date || '', unitId: action.unit_id || '' }
      : { ...emptyAction, unitId: unitId || (access('actions', null, true) ? '' : firstEditableUnit) })
  }

  async function submitAction(e) {
    e.preventDefault()
    if (!access('actions', actionDraft.unitId, true)) { setError('No tenés permiso para editar acciones en este establecimiento.'); return }
    const ok = await run(() => saveHysAction({
      companyId: company.id, userId: user.id, unitId: actionDraft.unitId,
      values: actionDraft, existing: editingAction,
    }), editingAction ? 'Acción actualizada con trazabilidad.' : 'Acción creada.')
    if (ok) { setActionDraft(null); setEditingAction(null) }
  }

  async function showHistory(action) {
    try {
      setError('')
      const entries = await listHysHistory({ companyId: company.id, actionId: action.id })
      setHistory({ action, entries })
    } catch (e) { setError(errorText(e)) }
  }

  function newRecord(existing = null, action = null) {
    const currentSection = action ? 'actions' : view === 'general' ? 'general' : section
    const categories = HYS_ALL_SECTIONS.find((s) => s.code === currentSection)?.categories || GENERAL_CATEGORIES
    setRecordDraft({
      ...emptyRecord, section: currentSection, unitId: action?.unit_id || (view === 'general' ? '' : unitId),
      category: existing?.category || (action ? 'Evidencias' : categories[0]),
      title: existing?.title || (action ? 'Evidencia: ' + action.title : ''),
      supersedesId: existing?.id || '', versionNo: existing ? existing.version_no + 1 : 1,
      actionId: action?.id || existing?.action_id || '',
    })
    setRecordFile(null)
  }

  async function submitRecord(e) {
    e.preventDefault()
    if (recordDraft.supersedesId && !recordFile) {
      setError('Para registrar una nueva versión, seleccioná el archivo actualizado.')
      return
    }
    const ok = await run(() => createHysRecord({
      companyId: company.id, unitId: recordDraft.unitId, userId: user.id,
      values: recordDraft, file: recordFile,
    }), 'Registro guardado en el legajo.')
    if (ok) { setRecordDraft(null); setRecordFile(null) }
  }

  async function submitGrant(e) {
    e.preventDefault()
    if (!grantDraft.userId) { setError('Seleccioná una persona.'); return }
    const ok = await run(() => saveHysGrant({
      companyId: company.id, userId: grantDraft.userId, actorId: user.id,
      unitId: grantDraft.section === 'general' ? null : grantDraft.unitId,
      section: grantDraft.section, permission: grantDraft.permission,
    }), 'Permiso guardado.')
    if (ok) setGrantDraft({ userId: '', section: 'actions', unitId: '', permission: 'read' })
  }

  function renderRecords() {
    const code = view === 'general' ? 'general' : section
    const currentUnit = view === 'general' ? null : unitId
    const allowed = access(code, currentUnit)
    return (
      <div className="hys-panel">
        <div className="hys-panel-head">
          <div><h2>{activeSection.number} · {activeSection.label}</h2>
            <p>{view === 'general' ? 'Documentación común a toda la empresa.' : 'Legajo específico de ' + unitName(unitId) + '.'}</p>
          </div>
          {access(code, currentUnit, true) && <button className="primary-button" onClick={() => newRecord()}><FilePlus2 size={16}/> Nuevo registro</button>}
        </div>
        <div className="hys-chips">{activeSection.categories.map((cat) => <span key={cat}>{cat}</span>)}</div>
        {!allowed ? <p className="hys-empty"><LockKeyhole size={18}/> No tenés acceso a este apartado.</p> :
          !visibleRecords.length ? <p className="hys-empty">Aún no hay registros cargados en este apartado.</p> :
            <div className="hys-doc-list">{visibleRecords.map((r) => (
              <article className={`hys-doc ${r.is_obsolete ? 'hys-obsolete' : ''}`} key={r.id}>
                <div className="hys-doc-icon"><FileText size={20}/></div>
                <div className="hys-grow">
                  <strong>{r.title}</strong><p>{r.category} · Versión {r.version_no}{r.is_obsolete ? ' · Obsoleto' : ''}</p>
                  {r.notes && <small>{r.notes}</small>}
                  <small>{r.recorded_at ? 'Fecha: ' + formatDate(r.recorded_at) + ' · ' : ''}{r.expires_at ? 'Vence: ' + formatDate(r.expires_at) : 'Sin vencimiento'}</small>
                </div>
                <div className="hys-item-actions">
                  {r.file_path && <button className="secondary-button" onClick={async () => { try { await openHysFile(r.file_path) } catch (e) { setError(errorText(e)) } }}>Abrir archivo</button>}
                  {access(code, currentUnit, true) && !r.is_obsolete && <>
                    <button className="hys-text-button" onClick={() => newRecord(r)}>Nueva versión</button>
                    <button className="hys-text-button" onClick={() => run(() => setHysRecordObsolete(r.id), 'Documento marcado como obsoleto.')}>Obsoletar</button>
                  </>}
                </div>
              </article>
            ))}</div>}
      </div>
    )
  }

  return (
    <section className="hys-page">
      <header className="page-heading hys-heading">
        <div><p className="eyebrow">EP GESTIÓN · PREVENCIÓN Y CUMPLIMIENTO</p><h1>Higiene y Seguridad</h1>
          <p>Legajos por establecimiento, visitas, documentación y plan de acción colaborativo.</p></div>
        <button className="secondary-button" disabled={loading} onClick={refresh}><RefreshCw size={16}/> Actualizar</button>
      </header>
      {error && <div className="page-error" role="alert">{error}</div>}
      {notice && <div className="page-success" role="status">{notice}</div>}
      <div className="hys-layout">
        <aside className="hys-nav" aria-label="Navegación de Higiene y Seguridad">
          <button className={view === 'overview' ? 'active' : ''} onClick={() => go('overview')}><LayoutDashboard size={18}/> Panel general</button>
          <button className={view === 'general' ? 'active' : ''} onClick={() => go('general')}><FileText size={18}/> Documentación general</button>
          <div className="hys-nav-caption">ESTABLECIMIENTOS Y SEDES</div>
          {data.units.map((u) => <button key={u.id} className={view === 'unit' && unitId === u.id ? 'active' : ''} onClick={() => go('unit', u.id)}><MapPin size={18}/><span>{u.name}</span></button>)}
          {isAdmin && <button className="hys-nav-add" onClick={() => setShowUnit(true)}><Plus size={16}/> Añadir establecimiento</button>}
          <div className="hys-nav-caption">SEGUIMIENTO</div>
          <button className={view === 'actions' ? 'active' : ''} onClick={() => go('actions')}><ClipboardList size={18}/> Plan de acción</button>
          {isAdmin && <button className={view === 'access' ? 'active' : ''} onClick={() => go('access')}><Users size={18}/> Permisos específicos</button>}
        </aside>
        <div className="hys-main">
          {loading ? <div className="hys-panel"><p>Cargando datos del módulo…</p></div> : <>
            {view === 'overview' && <>
              <div className="hys-metrics">
                <div className="hys-metric"><ShieldCheck size={20}/><span>Documentos vigentes con fecha</span><strong>{expiring.length ? Math.round(100 * valid / expiring.length) + '%' : '—'}</strong><small>{valid} de {expiring.length} con vencimiento registrado</small></div>
                <div className="hys-metric"><CalendarDays size={20}/><span>Documentos vencidos</span><strong>{due}</strong><small>En los legajos visibles</small></div>
                <div className="hys-metric"><ClipboardList size={20}/><span>Acciones pendientes</span><strong>{pending.length}</strong><small>{completed} verificadas</small></div>
                <div className="hys-metric"><CheckCircle2 size={20}/><span>Visitas registradas</span><strong>{data.records.filter((r) => r.section === 'visits').length}</strong><small>En los establecimientos habilitados</small></div>
              </div>
              <div className="hys-panel"><h2>Resumen por establecimiento</h2>
                {!data.units.length ? <p className="hys-empty">No hay establecimientos visibles. {isAdmin ? 'Creá el primero para comenzar.' : 'Solicitá acceso al administrador.'}</p> :
                  <div className="hys-unit-grid">{data.units.map((u) => <button key={u.id} className="hys-unit-card" onClick={() => go('unit', u.id)}>
                    <Building2 size={22}/><strong>{u.name}</strong><span>{u.kind === 'obra' ? 'Obra' : u.kind === 'prestacion' ? 'Lugar de prestación' : 'Sede'}</span>
                    <small>{data.records.filter((r) => r.unit_id === u.id).length} registros · {data.actions.filter((a) => a.unit_id === u.id && !['resuelta','verificada'].includes(a.status)).length} acciones pendientes</small>
                  </button>)}</div>}
              </div>
              <p className="hys-note">El porcentaje refleja únicamente documentos cargados con vencimiento. No equivale a una certificación de cumplimiento legal.</p>
            </>}
            {view === 'general' && renderRecords()}
            {view === 'unit' && <>
              <div className="hys-panel">
                <div className="hys-panel-head"><div><p className="eyebrow">ESTABLECIMIENTO</p><h2>{unitName(unitId)}</h2><p>Legajo de Higiene y Seguridad · 13 apartados</p></div></div>
                <div className="hys-section-grid">{HYS_SECTIONS.map((s) =>
                  <button key={s.code} className={section === s.code ? 'active' : ''} onClick={() => { if (s.code === 'actions') { setView('actions'); return } setSection(s.code) }}>
                    <b>{s.number}</b><span>{s.label}</span>{!access(s.code, unitId) && <LockKeyhole size={13}/>}
                  </button>)}</div>
              </div>
              {renderRecords()}
            </>}
            {view === 'actions' && <>
              <div className="hys-panel">
                <div className="hys-panel-head"><div><h2>Plan de acción editable en línea</h2><p>Los cambios quedan guardados en el sistema y registrados en el historial.</p></div>
                  <div className="hys-actions-row">
                    <button className="secondary-button" disabled={!actions.length} onClick={() => downloadActionsExcel(actions, unitName)}><Download size={16}/> Excel</button>
                    {canAddAction && <button className="primary-button" onClick={() => newAction()}><Plus size={16}/> Nueva acción</button>}
                  </div>
                </div>
                <label className="hys-filter">Establecimiento
                  <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                    <option value="">Todos los autorizados</option>
                    {data.units.map((u) => <option value={u.id} key={u.id}>{u.name}</option>)}
                  </select>
                </label>
                {actions.length ? <div className="hys-table-wrap"><table className="hys-table"><thead><tr><th>Acción</th><th>Sede</th><th>Responsable</th><th>Prioridad</th><th>Estado</th><th>Plazo</th><th>Operaciones</th></tr></thead><tbody>
                  {actions.map((a) => <tr key={a.id}><td><strong>{a.title}</strong><small>{a.description}</small></td><td>{a.unit_id ? unitName(a.unit_id) : 'General'}</td><td>{a.responsible || 'Sin asignar'}</td><td>{HYS_PRIORITIES[a.priority]}</td><td><span className={'hys-state hys-state-' + a.status}>{HYS_STATES[a.status]}</span></td><td>{formatDate(a.due_date)}</td>
                    <td><div className="hys-table-buttons">
                      {access('actions', a.unit_id, true) && <button onClick={() => newAction(a)}>Editar</button>}
                      <button onClick={() => showHistory(a)}><History size={14}/> Historial</button>
                      {access('actions', a.unit_id, true) && <button onClick={() => newRecord(null, a)}><UploadCloud size={14}/> Evidencia</button>}
                    </div></td></tr>)}
                </tbody></table></div> : <p className="hys-empty">No hay acciones visibles para este establecimiento.</p>}
              </div>
              <div className="hys-panel"><h3>Evidencias vinculadas al plan</h3>
                {data.records.filter((r) => r.section === 'actions' && (!unitId || r.unit_id === unitId)).length === 0 ?
                  <p className="hys-empty">Todavía no se adjuntaron evidencias.</p> :
                  <div className="hys-doc-list">{data.records.filter((r) => r.section === 'actions' && (!unitId || r.unit_id === unitId)).map((r) =>
                    <article className="hys-doc" key={r.id}><FileText size={18}/><div className="hys-grow"><strong>{r.title}</strong><small>{r.category} · Versión {r.version_no}</small></div>
                      {r.file_path && <button className="secondary-button" onClick={async () => { try { await openHysFile(r.file_path) } catch (e) { setError(errorText(e)) } }}>Abrir</button>}
                    </article>)}</div>}
              </div>
            </>}
            {view === 'access' && isAdmin && <div className="hys-panel">
              <div className="hys-panel-head"><div><h2>Permisos específicos</h2><p>Habilitá solo el apartado y la sede que necesite cada persona.</p></div><LockKeyhole size={24}/></div>
              <form className="hys-form hys-grants-form" onSubmit={submitGrant}>
                <label>Persona<select required value={grantDraft.userId} onChange={(e) => setGrantDraft({ ...grantDraft, userId: e.target.value })}>
                  <option value="">Elegir usuario activo</option>{data.members.map((m) => <option value={m.user_id} key={m.user_id}>{m.user?.full_name || m.user?.email || m.user_id} ({m.role})</option>)}
                </select></label>
                <label>Apartado<select value={grantDraft.section} onChange={(e) => setGrantDraft({ ...grantDraft, section: e.target.value, unitId: '' })}>
                  {HYS_ALL_SECTIONS.map((s) => <option value={s.code} key={s.code}>{s.number} · {s.label}</option>)}
                </select></label>
                <label>Alcance<select disabled={grantDraft.section === 'general'} value={grantDraft.unitId} onChange={(e) => setGrantDraft({ ...grantDraft, unitId: e.target.value })}>
                  <option value="">Toda la empresa</option>{data.units.map((u) => <option value={u.id} key={u.id}>{u.name}</option>)}
                </select></label>
                <label>Permiso<select value={grantDraft.permission} onChange={(e) => setGrantDraft({ ...grantDraft, permission: e.target.value })}>
                  <option value="read">Solo lectura</option><option value="edit">Lectura y edición</option>
                </select></label>
                <button className="primary-button" disabled={saving}>Guardar permiso</button>
              </form>
              {data.members.find((m) => m.user_id === grantDraft.userId && m.role === 'member') && (
                <div className="hys-restricted-access">
                  <div><strong>Acceso exclusivo a Higiene y Seguridad</strong>
                    <p>Para esta cuenta de tipo Usuario, oculta el SGI y bloquea sus documentos mediante permisos de base de datos. Solo podrá abrir los apartados HyS autorizados.</p></div>
                  <button className="secondary-button" disabled={saving} onClick={() => {
                    const member = data.members.find((m) => m.user_id === grantDraft.userId)
                    run(() => setHysOnly({ companyId: company.id, userId: member.user_id, enabled: !member.hys_only }),
                      member.hys_only ? 'Acceso de empresa restaurado.' : 'Acceso limitado exclusivamente a HyS.')
                  }}>
                    {data.members.find((m) => m.user_id === grantDraft.userId)?.hys_only ? 'Restaurar acceso estándar' : 'Activar acceso exclusivo'}
                  </button>
                </div>
              )}
              <h3>Autorizaciones existentes</h3>
              {!data.grants.length ? <p className="hys-empty">Todavía no se asignaron permisos específicos.</p> :
                <div className="hys-grants-list">{data.grants.map((g) => <div className="hys-grant-row" key={g.id}>
                  <span><strong>{data.members.find((m) => m.user_id === g.user_id)?.user?.full_name || data.members.find((m) => m.user_id === g.user_id)?.user?.email || g.user_id}</strong>
                    <small>{sectionLabel(g.section)} · {g.unit_id ? unitName(g.unit_id) : 'Toda la empresa'} · {g.permission === 'edit' ? 'Edición' : 'Lectura'}</small></span>
                  <button className="hys-text-button" disabled={saving} onClick={() => run(() => removeHysGrant(g.id), 'Acceso revocado.')}>Revocar</button>
                </div>)}</div>}
              <p className="hys-note">Un permiso de HyS no concede acceso al SGI, a otras carpetas ni a otras empresas.</p>
            </div>}
          </>}
        </div>
      </div>

      {showUnit && <div className="hys-overlay" role="presentation"><form className="hys-dialog" onSubmit={createUnit}>
        <div className="hys-modal-title"><h2>Nuevo establecimiento</h2><button type="button" onClick={() => setShowUnit(false)} aria-label="Cerrar"><X size={20}/></button></div>
        <label>Nombre<input required minLength={2} maxLength={160} value={unitDraft.name} onChange={(e) => setUnitDraft({ ...unitDraft, name: e.target.value })} placeholder="Cocina / Institución A"/></label>
        <label>Tipo<select value={unitDraft.kind} onChange={(e) => setUnitDraft({ ...unitDraft, kind: e.target.value })}><option value="sede">Sede</option><option value="obra">Obra</option><option value="prestacion">Lugar de prestación</option></select></label>
        <button className="primary-button" disabled={saving}>Crear establecimiento</button>
      </form></div>}

      {actionDraft && <div className="hys-overlay" role="presentation"><form className="hys-dialog" onSubmit={submitAction}>
        <div className="hys-modal-title"><h2>{editingAction ? 'Editar acción' : 'Nueva acción correctiva'}</h2><button type="button" onClick={() => setActionDraft(null)} aria-label="Cerrar"><X size={20}/></button></div>
        <label>Establecimiento<select disabled={Boolean(editingAction)} value={actionDraft.unitId} onChange={(e) => setActionDraft({ ...actionDraft, unitId: e.target.value })}>
          {access('actions', null, true) && <option value="">General (empresa)</option>}
          {data.units.filter((u) => access('actions', u.id, true)).map((u) => <option value={u.id} key={u.id}>{u.name}</option>)}
        </select></label>
        <label>Acción<input required minLength={3} maxLength={180} value={actionDraft.title} onChange={(e) => setActionDraft({ ...actionDraft, title: e.target.value })}/></label>
        <label>Descripción<textarea rows={3} value={actionDraft.description} onChange={(e) => setActionDraft({ ...actionDraft, description: e.target.value })}/></label>
        <div className="hys-form-grid">
          <label>Responsable<input value={actionDraft.responsible} onChange={(e) => setActionDraft({ ...actionDraft, responsible: e.target.value })}/></label>
          <label>Fecha límite<input type="date" value={actionDraft.due_date} onChange={(e) => setActionDraft({ ...actionDraft, due_date: e.target.value })}/></label>
          <label>Prioridad<select value={actionDraft.priority} onChange={(e) => setActionDraft({ ...actionDraft, priority: e.target.value })}>{Object.entries(HYS_PRIORITIES).map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></label>
          <label>Estado<select value={actionDraft.status} onChange={(e) => setActionDraft({ ...actionDraft, status: e.target.value })}>{Object.entries(HYS_STATES).map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></label>
        </div>
        <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar acción'}</button>
      </form></div>}

      {recordDraft && <div className="hys-overlay" role="presentation"><form className="hys-dialog" onSubmit={submitRecord}>
        <div className="hys-modal-title"><h2>{recordDraft.supersedesId ? 'Nueva versión' : 'Nuevo registro documental'}</h2><button type="button" onClick={() => setRecordDraft(null)} aria-label="Cerrar"><X size={20}/></button></div>
        <p className="hys-note">{sectionLabel(recordDraft.section)}{recordDraft.versionNo > 1 ? ' · Versión ' + recordDraft.versionNo : ''}</p>
        <label>Subapartado<select value={recordDraft.category} onChange={(e) => setRecordDraft({ ...recordDraft, category: e.target.value })}>
          {(HYS_ALL_SECTIONS.find((s) => s.code === recordDraft.section)?.categories || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select></label>
        <label>Título<input required maxLength={180} minLength={2} value={recordDraft.title} onChange={(e) => setRecordDraft({ ...recordDraft, title: e.target.value })}/></label>
        <label>Observaciones<textarea rows={3} value={recordDraft.notes} onChange={(e) => setRecordDraft({ ...recordDraft, notes: e.target.value })}/></label>
        <div className="hys-form-grid">
          <label>Fecha del registro<input type="date" value={recordDraft.recorded_at} onChange={(e) => setRecordDraft({ ...recordDraft, recorded_at: e.target.value })}/></label>
          <label>Vencimiento (opcional)<input type="date" value={recordDraft.expires_at} onChange={(e) => setRecordDraft({ ...recordDraft, expires_at: e.target.value })}/></label>
        </div>
        <label>Archivo {recordDraft.supersedesId ? '(obligatorio para nueva versión)' : '(opcional)'}<input type="file" required={Boolean(recordDraft.supersedesId)} onChange={(e) => setRecordFile(e.target.files?.[0] || null)}/></label>
        <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar en legajo'}</button>
      </form></div>}

      {history && <div className="hys-overlay" role="presentation"><div className="hys-dialog">
        <div className="hys-modal-title"><h2>Historial de la acción</h2><button type="button" aria-label="Cerrar" onClick={() => setHistory(null)}><X size={20}/></button></div>
        <p>{history.action.title}</p>
        <div className="hys-history-list">{history.entries.map((h) => <div key={h.id}>
          <strong>{h.event === 'created' ? 'Creación' : h.event === 'updated' ? 'Modificación' : 'Eliminación'}</strong>
          <small>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(h.created_at))} · {h.actor_id || 'Sistema'}</small>
          <span>{HYS_STATES[h.details?.status] || h.details?.status || ''} · {h.details?.responsible || 'Sin responsable'} · Versión {h.details?.version || 1}</span>
        </div>)}</div>
      </div></div>}
    </section>
  )
}
