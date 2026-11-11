import {
  Building2, CalendarDays, CheckCircle2, ChevronLeft, ClipboardList, Download, FilePlus2, FolderOpen,
  FileText, FolderPlus, History, LayoutDashboard, LockKeyhole, MapPin, Pencil, Plus, RefreshCw, Trash2,
  ShieldCheck, UploadCloud, Users, X, RotateCcw,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HysFilePreview from '../components/HysFilePreview'
import { useAuth } from '../context/AuthContext'
import { GENERAL_MATRIX, GENERAL_CATEGORIES, HYS_ALL_SECTIONS, HYS_SECTIONS, HYS_PRIORITIES, HYS_STATES, hysConfiguredSections, sectionLabel } from '../lib/hysCatalog'
import {
  addHysUnit, canUseHys, createHysRecord, downloadActionsExcel, listHysHistory,
  loadHys, isPreviewableHysFile, downloadHysFile, inspectHysActionsWorkbook, previewHysActionsWorkbook,
  HYS_IMPORT_MAPPING_FIELDS, hysActionImportKey, removeHysGrant, saveHysAction, saveHysCompanyDetails, saveHysGrant, saveHysFolder, deleteHysFolder, saveHysUnitSection, setHysRecordObsolete, setHysOnly,
} from '../services/hysService'

const initial = { units: [], actions: [], records: [], folders: [], foldersAvailable: true, sectionSettings: [], sectionSettingsAvailable: true, grants: [], members: [], companyDetails: null, companyDetailsAvailable: true }
const emptyCompany = { legal_name: '', cuit: '', activity: '', art_provider: '' }
const emptyAction = { title: '', description: '', responsible: '', priority: 'media', status: 'pendiente', due_date: '', unitId: '' }
const emptyRecord = { title: '', notes: '', category: '', recorded_at: '', expires_at: '', supersedesId: '', versionNo: 1, actionId: '' }
const formatDate = (date) => date ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00')) : '—'
const errorText = (error) => {
  const message = error?.message || ''
  if (/row.level security|permission denied|not authorized|unauthorized/i.test(message)) {
    return 'No tenés permisos para esta operación. Revisá el acceso al establecimiento. ' + message
  }
  if (/bucket not found|hys-files.*not found/i.test(message)) {
    return 'No está configurado el almacenamiento de Higiene y Seguridad. Revisá el SQL. ' + message
  }
  if (/schema cache|could not find the table|relation .* does not exist/i.test(message)) {
    return 'Falta aplicar o actualizar la estructura SQL de Higiene y Seguridad. ' + message
  }
  return message || 'Ocurrió un error al guardar los cambios.'
}

export default function HysPage() {
  const { company, user, role } = useAuth()
  return <HysWorkspace key={JSON.stringify([company?.id, user?.id, role])} company={company} user={user} isAdmin={role === 'admin'}/>
}

function HysWorkspace({ company, user, isAdmin }) {
  const [preview, setPreview] = useState(null)
  const [data, setData] = useState(initial)
  const [view, setView] = useState('overview')
  const [unitId, setUnitId] = useState('')
  const [section, setSection] = useState('legal')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [generalGroup, setGeneralGroup] = useState(null)
  const [folderDraft, setFolderDraft] = useState(null)
  const [sectionsOpen, setSectionsOpen] = useState(false)
  const [sectionToDelete, setSectionToDelete] = useState(null)
  const [sectionDraft, setSectionDraft] = useState(null)
  const [lastSectionChange, setLastSectionChange] = useState(null)
  const [folderTrail, setFolderTrail] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [overviewUnit, setOverviewUnit] = useState('')
  const [showUnit, setShowUnit] = useState(false)
  const [companyDraft, setCompanyDraft] = useState(emptyCompany)
  const [unitDraft, setUnitDraft] = useState({ name: '', kind: 'sede', address: '' })
  const [actionDraft, setActionDraft] = useState(null)
  const [editingAction, setEditingAction] = useState(null)
  const [recordDraft, setRecordDraft] = useState(null)
  const [recordFile, setRecordFile] = useState(null)
  const [recordError, setRecordError] = useState('')
  const [grantDraft, setGrantDraft] = useState({ userId: '', section: 'actions', unitId: '', permission: 'read' })
  const [history, setHistory] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importAnalysis, setImportAnalysis] = useState(null)
  const [importMapping, setImportMapping] = useState({})
  const [importSummary, setImportSummary] = useState(null)
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)

  const requestVersion = useRef(0)
  const refresh = useCallback(async () => {
    if (!company?.id) return
    const version = ++requestVersion.current
    setLoading(true)
    setData(initial)
    try {
      const next = await loadHys({ companyId: company.id, isAdmin })
      if (version !== requestVersion.current) return
      setData(next)
      setCompanyDraft({ ...emptyCompany, ...(next.companyDetails || {}) })
      setError('')
    } catch (e) {
      if (version !== requestVersion.current) return
      setData(initial)
      setCompanyDraft(emptyCompany)
      setError(errorText(e))
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [company?.id, isAdmin])

  useEffect(() => { refresh(); return () => { requestVersion.current += 1 } }, [refresh])

  const overviewUnitId = data.units.find(u => u.id === overviewUnit)?.id || data.units[0]?.id || ''
  const unitName = useCallback((id) => data.units.find((u) => u.id === id)?.name || 'Establecimiento', [data.units])
  const access = useCallback((code, id, write = false) =>
    canUseHys({ isAdmin, grants: data.grants, section: code, unitId: id || null, write }),
  [isAdmin, data.grants])

  const actions = useMemo(() => data.actions.filter((a) => !unitId || a.unit_id === unitId), [data.actions, unitId])
  const sectionsForUnit = (id) => hysConfiguredSections(data.sectionSettings, id, company.id)
  const visibleSectionsForUnit = (id) => sectionsForUnit(id).filter(s => s.enabled && access(s.code, id))
  const unitSections = visibleSectionsForUnit(unitId)
  const activeSection = view === 'general'
    ? HYS_ALL_SECTIONS[0]
    : unitSections.find(s => s.code === section) || unitSections[0] || HYS_SECTIONS[0]
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Argentina/Buenos_Aires'}).format(new Date())

  const replaced = new Set(data.records.map(r => r.supersedes_id).filter(Boolean))
  const currentRecords = data.records.filter(r => !replaced.has(r.id) && !r.is_obsolete)
  const expiring = currentRecords.filter((r) => r.expires_at && !r.is_obsolete)
  const due = expiring.filter(r => r.expires_at < today).length
  const valid = expiring.filter((r) => r.expires_at >= today).length
  const pending = data.actions.filter((a) => !['verificada', 'resuelta'].includes(a.status))
  const completed = data.actions.filter((a) => a.status === 'verificada').length
  const canAddAction = unitId ? access('actions', unitId, true) : access('actions', null, true) || data.units.some((u) => access('actions', u.id, true))
  const importPlan = useMemo(() => importAnalysis
    ? previewHysActionsWorkbook(importAnalysis, {
      mapping: importMapping, units: data.units, defaultUnitId: unitId,
      canEdit: id => access('actions', id, true), existingActions: data.actions,
    })
    : null, [importAnalysis, importMapping, data.units, data.actions, unitId, access])

  const go = (nextView, nextUnitId = '') => {
    setGeneralGroup(null)
    setFolderDraft(null)
    setFolderTrail([])
    setSectionsOpen(false)
    setSectionToDelete(null)
    setSectionDraft(null)
    setLastSectionChange(null)
    setView(nextView)
    setUnitId(nextUnitId)
    setSelectedCategory('')
    setError('')
    setNotice('')
    if (nextView === 'unit') setSection(visibleSectionsForUnit(nextUnitId)[0]?.code || '')
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

  async function submitSection(event) {
    event.preventDefault()
    if (!sectionDraft || !unitId || data.sectionSettingsAvailable === false) return
    const name = sectionDraft.label.trim()
    const options = sectionsForUnit(unitId)
    if (options.some(s => s.code !== sectionDraft.code && s.enabled &&
      s.label.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) {
      setError('Ya existe un apartado con ese nombre en este establecimiento.')
      return
    }
    const isNew = !sectionDraft.code
    const code = sectionDraft.code || 'custom_' + crypto.randomUUID()
    const previous = options.find(s => s.code === code) || null
    const ok = await run(() => saveHysUnitSection({
      companyId: company.id, unitId, code, label: name,
      enabled: sectionDraft.enabled !== false,
    }), isNew ? 'Apartado creado para este establecimiento.' : 'Nombre del apartado actualizado.')
    if (ok) {
      setLastSectionChange({ unitId, code, previous: previous
        ? { label: previous.label, enabled: previous.enabled } : null, label: name })
      setSectionDraft(null)
      setSectionsOpen(false)
      if (isNew) { setSection(code); setSelectedCategory(''); setFolderTrail([]) }
    }
  }

  async function toggleSection(item) {
    const enabled = !item.enabled
    const ok = await run(() => saveHysUnitSection({
      companyId: company.id, unitId, code: item.code, label: item.label, enabled,
    }), enabled ? 'Apartado restaurado con sus documentos.' : 'Apartado ocultado. No se borró ningún archivo.')
    if (ok) {
      setSectionToDelete(null)
      setLastSectionChange({ unitId, code: item.code,
        previous: { label: item.label, enabled: item.enabled }, label: item.label })
      if (!enabled && section === item.code) {
        setSection(visibleSectionsForUnit(unitId).find(s => s.code !== item.code)?.code || '')
        setSelectedCategory('')
        setFolderTrail([])
      }
    }
  }

  async function undoSectionChange() {
    const last = lastSectionChange
    if (!last) return
    const previous = last.previous || { label: last.label, enabled: false }
    const ok = await run(() => saveHysUnitSection({
      companyId: company.id, unitId: last.unitId, code: last.code,
      label: previous.label, enabled: previous.enabled,
    }), 'Último cambio deshecho.')
    if (ok) {
      setLastSectionChange(null)
      if (previous.enabled) setSection(last.code)
      else if (section === last.code) setSection(visibleSectionsForUnit(last.unitId).find(s => s.code !== last.code)?.code || '')
    }
  }

  async function createUnit(e) {
    e.preventDefault()
    const ok = await run(() => addHysUnit({ companyId: company.id, ...unitDraft }), 'Establecimiento creado.')
    if (ok) { setShowUnit(false); setUnitDraft({ name: '', kind: 'sede', address: '' }) }
  }


  function openFolder(folder) {
    setSelectedCategory(folder.category)
    setFolderTrail(previous => [...previous, { category: folder.category, name: folder.name }])
  }

  function backFolder() {
    const previous = folderTrail.slice(0, -1)
    setFolderTrail(previous)
    setSelectedCategory(previous.at(-1)?.category || '')
  }

  function editFolder(folder = null, parentCategory = null, targetSection = null, targetUnit = null) {
    setFolderDraft({
      mode: folder ? 'edit' : 'create', id: folder?.id || null,
      category: folder?.category || '',
      name: folder?.name || '',
      parentCategory: folder ? (folder.parent_category || '') : (parentCategory || ''),
      section: targetSection || folder?.section || (view === 'general' ? 'general' : section),
      unitId: targetUnit ?? folder?.unit_id ?? (view === 'general' ? '' : unitId),
    })
  }

  function folderParentOptions(draft) {
    if (!draft) return []
    const scope = (data.folders || []).filter(f => f.company_id === company.id && f.section === draft.section && (f.unit_id || '') === (draft.unitId || ''))
    const fixed = draft.section === 'general'
      ? GENERAL_CATEGORIES.map(name => ({ value: name, label: name }))
      : (sectionsForUnit(draft.unitId).find(item => item.code === draft.section)?.categories || [])
          .map(name => ({ value: name, label: name }))
    const values = [{ value: '', label: 'Raíz del apartado' }, ...fixed,
      ...scope.map(f => ({ value: f.category, label: '📁 ' + f.category }))]
    return values.filter((item, i) => values.findIndex(other => other.value === item.value) === i)
      .filter(item => !draft.id || (item.value !== draft.category && !item.value.startsWith(draft.category + ' / ')))
  }

  async function submitFolder(event) {
    event.preventDefault()
    if (!folderDraft) return
    const current = folderDraft
    const ok = await run(() => saveHysFolder({
      companyId: company.id, unitId: current.unitId, section: current.section,
      parentCategory: current.parentCategory || null, name: current.name, id: current.id,
    }), current.id ? 'Carpeta actualizada. Sus documentos permanecen vinculados.' : 'Carpeta creada. Ya podés guardar documentos.')
    if (ok) {
      setFolderDraft(null)
      if (current.id) { setSelectedCategory(''); setFolderTrail([]) }
    }
  }

  async function confirmDeleteFolder() {
    if (!folderDraft?.id) return
    const current = folderDraft
    const ok = await run(() => deleteHysFolder(current.id), 'Carpeta vacía eliminada.')
    if (ok) { setFolderDraft(null); setSelectedCategory(''); setFolderTrail([]) }
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

  function newRecord(existing = null, action = null, category = '', requireFile = false) {
    const currentSection = existing?.section || (action ? 'actions' : view === 'general' ? 'general' : section)
    const categories = (currentSection === 'general' ? GENERAL_CATEGORIES
      : sectionsForUnit(existing?.unit_id || action?.unit_id || unitId)
        .find(s => s.code === currentSection)?.categories) || ['Otros']
    setRecordDraft({
      ...emptyRecord, section: currentSection, unitId: existing ? existing.unit_id : action ? action.unit_id : (view === 'general' ? '' : unitId),
      category: existing?.category || (action ? 'Evidencias' : (category || selectedCategory || categories[0] || '')),
      requireFile: Boolean(requireFile || existing),
      title: existing?.title || (action ? 'Evidencia: ' + action.title : ''),
      supersedesId: existing?.id || '', versionNo: existing ? existing.version_no + 1 : 1,
      actionId: action?.id || existing?.action_id || '',
    })
    setRecordFile(null)
    setRecordError('')
  }

  async function submitRecord(e) {
    e.preventDefault()
    setRecordError('')
    if ((recordDraft.requireFile || recordDraft.supersedesId) && !recordFile) {
      setRecordError('Seleccioná el archivo que querés cargar.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await createHysRecord({
        companyId: company.id, unitId: recordDraft.unitId, userId: user.id,
        values: recordDraft, file: recordFile,
      })
      if (view === 'general') setSelectedCategory(recordDraft.category)
      setRecordDraft(null)
      setRecordFile(null)
      await refresh()
      setNotice(recordFile ? 'Archivo cargado correctamente en el legajo.' : 'Registro guardado en el legajo.')
    } catch (e) {
      setRecordError(errorText(e))
    } finally {
      setSaving(false)
    }
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

  async function selectActionsExcel(event) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    setImportAnalysis(null)
    setImportSummary(null)
    setImportError('')
    try {
      const analysis = await inspectHysActionsWorkbook(file)
      setImportMapping(analysis.mapping)
      setImportAnalysis(analysis)
    } catch (e) {
      setImportError(errorText(e))
    }
  }

  async function confirmActionsImport() {
    if (importing || !importPlan?.rows.length) return
    setImporting(true)
    setImportError('')
    let saved = 0
    const skipped = [...importPlan.skipped]
    try {
      for (const row of importPlan.rows) {
        const importKey = await hysActionImportKey(company.id, row)
        const result = await saveHysAction({
          companyId: company.id, unitId: row.unitId, userId: user.id,
          values: row.values, importKey,
        })
        if (result.duplicate) skipped.push({ rowNumber: row.rowNumber, reason: 'Acción duplicada (ya importada)' })
        else saved++
      }
      setImportSummary({ imported: saved, skipped })
      setNotice(saved + ' acciones importadas. ' + skipped.length + ' omitidas.')
    } catch (e) {
      setImportError('Se guardaron ' + saved + ' acciones antes del error: ' + errorText(e) +
        ' Actualizá la vista previa y reintentá las pendientes.')
      setImportSummary(null)
    } finally {
      await refresh()
      setImporting(false)
    }
  }

  function fileButtons(record) {
    if (!record.file_path) return null
    const office = /\.(docx?|xlsx?)$/i.test(record.file_name)
    const open = async (download = false) => {
      try {
        if (!download) setPreview(record)
        else await downloadHysFile(record)
      } catch (e) { setError(errorText(e)) }
    }
    return <>
      {(office || isPreviewableHysFile(record.file_name)) && <button className="secondary-button" onClick={() => open()}>Ver archivo</button>}
      <button className="hys-text-button" onClick={() => open(true)}>Descargar</button>
    </>
  }

  function renderRecords() {
    const code = view === 'general' ? 'general' : section
    const currentUnit = view === 'general' ? null : unitId
    const allowed = access(code, currentUnit)
    const canWrite = access(code, currentUnit, true)
    const sectionRecords = data.records.filter(r =>
      r.company_id === company.id && r.section === code && (r.unit_id || '') === (view === 'general' ? '' : unitId))
    const scopeFolders = (data.folders || []).filter(f =>
      f.company_id === company.id && f.section === code && (f.unit_id || '') === (currentUnit || ''))
    const general = view === 'general'
    const inGroup = Boolean(general && generalGroup)
    const parent = inGroup ? generalGroup.prefix : null
    const activeNames = inGroup ? [] : general ? GENERAL_CATEGORIES : activeSection.categories
    const defaults = activeNames.map(name => ({ name, category: inGroup ? parent + name : name }))
    const custom = scopeFolders.filter(f => f.parent_category === parent)
      .map(f => ({ ...f, category: f.category }))
    const isDescendant = (child, root) => child.startsWith(root + ' / ')
    const legacy = [...new Set([...sectionRecords.map(r => r.category), ...scopeFolders.map(f => f.parent_category).filter(Boolean)]
      .filter(category => inGroup ? category.startsWith(parent) : general
        ? !GENERAL_MATRIX.some(group => category.startsWith(group.prefix))
        : true)
      .filter(category => ![...defaults, ...scopeFolders].some(f =>
        category === f.category || isDescendant(category, f.category))))]
      .map(category => ({ name: inGroup ? category.slice(parent.length) : category, category }))
    const rootEntries = [...defaults, ...custom, ...legacy]
      .filter((item, index, list) => list.findIndex(other => other.category === item.category) === index)
    const openedRecords = sectionRecords.filter(r => r.category === selectedCategory)
    const children = scopeFolders.filter(f => f.parent_category === selectedCategory)
    const openedFolder = scopeFolders.find(f => f.category === selectedCategory)
    const folderName = folderTrail.at(-1)?.name ||
      (inGroup ? selectedCategory.slice(generalGroup.prefix.length) : selectedCategory)

    function folderCard(folder) {
      const managed = scopeFolders.find(f => f.category === folder.category)
      const count = sectionRecords.filter(r => r.category === folder.category ||
        isDescendant(r.category, folder.category)).length
      return <div className="hys-folder-card" key={folder.category}>
        <button type="button" className="hys-folder-open" onClick={() => openFolder(folder)}>
          <FolderOpen size={20}/><span>{folder.name}</span>
          <small>{count} {count === 1 ? 'registro' : 'registros'}</small>
        </button>
        {canWrite && managed && <div className="hys-folder-card-actions">
          <button type="button" disabled={saving} aria-label={'Editar carpeta ' + folder.name}
            onClick={() => editFolder(managed)}><Pencil size={14}/> Editar / mover</button>
          <button type="button" disabled={saving} aria-label={'Eliminar carpeta ' + folder.name}
            onClick={() => setFolderDraft({
              id: managed.id, category: managed.category, name: managed.name, mode: 'delete',
              section: code, unitId: currentUnit || '', parentCategory: managed.parent_category || '',
            })}><Trash2 size={14}/> Eliminar</button>
        </div>}
      </div>
    }

    return <div className="hys-panel">
      <div className="hys-panel-head">
        <div><h2>{inGroup ? generalGroup.number + ' · ' + generalGroup.label : activeSection.number + ' · ' + activeSection.label}</h2>
          <p>{general ? 'Documentación común a toda la empresa.' : 'Legajo específico de ' + unitName(unitId) + '.'}</p>
        </div>
        {canWrite && (!general || selectedCategory) && <button className="primary-button" onClick={() => newRecord()}><FilePlus2 size={16}/> Nuevo registro</button>}
      </div>
      {!allowed ? <p className="hys-empty"><LockKeyhole size={18}/> No tenés acceso a este apartado.</p> : <>
        {data.foldersAvailable === false && canWrite && <p className="hys-config-warning">
          Para gestionar carpetas vacías, nombres y movimientos falta aplicar el complemento SQL de carpetas HyS.
          Los documentos existentes siguen accesibles.
        </p>}
        {selectedCategory ? <>
          <button className="hys-back-button" type="button" onClick={backFolder}>
            <ChevronLeft size={16}/> {folderTrail.length > 1 ? 'Volver a la carpeta anterior' : general && !inGroup ? 'Volver a la matriz' : 'Volver a los subapartados'}
          </button>
          <div className="hys-folder-heading">
            <div><FolderOpen size={23}/><div><strong>{folderName}</strong>
              <small>{openedRecords.length} documento(s) y registro(s) en esta carpeta</small></div></div>
            <div className="hys-item-actions">
              {canWrite && openedFolder && <button className="secondary-button" type="button" onClick={() => editFolder(openedFolder)}>
                <Pencil size={15}/> Editar / mover
              </button>}
              {canWrite && data.foldersAvailable !== false && <button className="secondary-button" type="button"
                onClick={() => editFolder(null, selectedCategory, code, currentUnit)}>
                <FolderPlus size={15}/> Nueva subcarpeta
              </button>}
              {canWrite && <button className="primary-button" onClick={() => newRecord(null, null, selectedCategory, true)}>
                <UploadCloud size={16}/> Subir documento
              </button>}
            </div>
          </div>
          {children.length > 0 && <>
            <h3>Subcarpetas</h3>
            <div className="hys-folder-grid">{children.map(folderCard)}</div>
          </>}
          {openedRecords.length ? <div className="hys-doc-list">{openedRecords.map(r => (
            <article className={'hys-doc ' + (r.is_obsolete ? 'hys-obsolete' : '')} key={r.id}>
              <div className="hys-doc-icon"><FileText size={20}/></div>
              <div className="hys-grow">
                <strong>{r.title}</strong><p>Versión {r.version_no}{r.is_obsolete ? ' · Obsoleto' : replaced.has(r.id) ? ' · Versión anterior' : ''}</p>
                {r.notes && <small>{r.notes}</small>}
                <small>{r.recorded_at ? 'Fecha: ' + formatDate(r.recorded_at) + ' · ' : ''}{r.expires_at ? 'Vence: ' + formatDate(r.expires_at) : 'Sin vencimiento'}</small>
              </div>
              <div className="hys-item-actions">
                {fileButtons(r)}
                {canWrite && !r.is_obsolete && !replaced.has(r.id) && <>
                  <button className="hys-text-button" onClick={() => newRecord(r)}>Nueva versión</button>
                  <button className="hys-text-button" onClick={() => run(() => setHysRecordObsolete(r.id), 'Documento marcado como obsoleto.')}>Obsoletar</button>
                </>}
              </div>
            </article>
          ))}</div> : <p className="hys-empty">Esta carpeta no tiene documentos. {canWrite ? 'Podés subir el primero o crear subcarpetas.' : 'Todavía no hay documentos cargados.'}</p>}
        </> : general && !inGroup ? <>
          <div className="hys-folder-toolbar">
            <p className="hys-folder-intro">Elegí una carpeta para consultar o cargar archivos.</p>
            {canWrite && data.foldersAvailable !== false && <button className="secondary-button" type="button"
              onClick={() => editFolder(null, null, code, currentUnit)}><FolderPlus size={16}/> Crear carpeta</button>}
          </div>
          <div className="hys-folder-grid">{GENERAL_MATRIX.filter(group => [...sectionRecords, ...scopeFolders].some(row => row.category.startsWith(group.prefix))).map(group => <button type="button" key={group.code} onClick={() => {
            setGeneralGroup(group); setSelectedCategory(''); setFolderTrail([])
          }}><FolderOpen size={20}/><span>{group.number} · {group.label}</span></button>)}</div>
          {rootEntries.length > 0 && <>
            <h3>Carpetas</h3>
            <div className="hys-folder-grid">{rootEntries.map(folderCard)}</div>
          </>}
        </> : <>
          {inGroup && <button className="hys-back-button" onClick={() => {
            setGeneralGroup(null); setSelectedCategory(''); setFolderTrail([])
          }}><ChevronLeft size={16}/> Volver a la matriz</button>}
          <div className="hys-folder-toolbar">
            <p className="hys-folder-intro">Elegí un subapartado para consultar o cargar archivos. Las carpetas creadas se conservan aunque estén vacías.</p>
            {canWrite && data.foldersAvailable !== false && <button className="secondary-button" type="button"
              onClick={() => editFolder(null, parent, code, currentUnit)}><FolderPlus size={16}/>
              {inGroup ? 'Crear subcarpeta' : 'Crear carpeta'}</button>}
          </div>
          <div className="hys-folder-grid">{rootEntries.map(folderCard)}</div>
        </>}
      </>}
    </div>
  }

  return (
    <section className="hys-page">
      <header className="page-heading hys-heading">
        <div><p className="eyebrow">EP GESTIÓN · PREVENCIÓN Y CUMPLIMIENTO</p><h1>Higiene y Seguridad</h1>
          <p>Legajos por establecimiento, visitas, documentación y plan de acción colaborativo.</p></div>
        <button className="secondary-button" disabled={loading} onClick={refresh}><RefreshCw size={16}/> Actualizar</button>
      </header>
      {error && <div className="page-error" role="alert">{error}</div>}
      {notice && <div className="page-success" role="status">{notice}
        {lastSectionChange?.unitId === unitId && <button className="hys-text-button"
          type="button" disabled={saving} onClick={undoSectionChange}>Deshacer último cambio</button>}
      </div>}
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
              <div className="hys-panel">
                <div className="hys-panel-head"><div><h2>Ficha de empresa / cliente</h2><p>Datos comunes a los establecimientos y legajos.</p></div><Building2 size={22}/></div>
                {isAdmin && data.companyDetailsAvailable ? <form className="hys-form hys-company-form" onSubmit={async (e) => {
                  e.preventDefault()
                  await run(() => saveHysCompanyDetails({ companyId: company.id, values: companyDraft }), 'Ficha de empresa actualizada.')
                }}>
                  <label>Razón social<input value={companyDraft.legal_name || ''} onChange={(e) => setCompanyDraft({ ...companyDraft, legal_name: e.target.value })} placeholder={company.name} maxLength={180}/></label>
                  <label>CUIT<input value={companyDraft.cuit || ''} onChange={(e) => setCompanyDraft({ ...companyDraft, cuit: e.target.value })} placeholder="11 dígitos" inputMode="numeric" maxLength={13}/></label>
                  <label>Actividad<input value={companyDraft.activity || ''} onChange={(e) => setCompanyDraft({ ...companyDraft, activity: e.target.value })} placeholder="Industria, servicios, construcción…"/></label>
                  <label>ART / Cobertura<input value={companyDraft.art_provider || ''} onChange={(e) => setCompanyDraft({ ...companyDraft, art_provider: e.target.value })}/></label>
                  <button className="primary-button" disabled={saving}>Guardar ficha</button>
                </form> : !data.companyDetailsAvailable ? <p className="hys-config-warning">La ficha de empresa necesita el complemento SQL de compatibilidad. Los legajos y documentos siguen disponibles.</p> : <div className="hys-company-info">
                  <strong>{data.companyDetails?.legal_name || company.name}</strong>
                  <span>CUIT: {data.companyDetails?.cuit || 'No registrado'}</span>
                  <span>Actividad: {data.companyDetails?.activity || 'No registrada'}</span>
                  <span>ART: {data.companyDetails?.art_provider || 'No registrada'}</span>
                </div>}
              </div>
              <div className="hys-metrics">
                <div className="hys-metric"><ShieldCheck size={20}/><span>Documentos vigentes con fecha</span><strong>{expiring.length ? Math.round(100 * valid / expiring.length) + '%' : '—'}</strong><small>{valid} de {expiring.length} con vencimiento registrado</small></div>
                <div className="hys-metric"><CalendarDays size={20}/><span>Documentos vencidos</span><strong>{due}</strong><small>En los legajos visibles</small></div>
                <div className="hys-metric"><ClipboardList size={20}/><span>Acciones pendientes</span><strong>{pending.length}</strong><small>{completed} verificadas</small></div>
                <div className="hys-metric"><CheckCircle2 size={20}/><span>Visitas registradas</span><strong>{currentRecords.filter((r) => r.section === 'visits').length}</strong><small>En los establecimientos habilitados</small></div>
              </div>
              <div className="hys-panel"><h2>Resumen por establecimiento</h2>
                {!data.units.length ? <p className="hys-empty">No hay establecimientos visibles. {isAdmin ? 'Creá el primero para comenzar.' : 'Solicitá acceso al administrador.'}</p> :
                  <div className="hys-unit-grid">{data.units.map((u) => <button key={u.id} className="hys-unit-card" onClick={() => go('unit', u.id)}>
                    <Building2 size={22}/><strong>{u.name}</strong><span>{u.kind === 'obra' ? 'Obra' : u.kind === 'prestacion' ? 'Lugar de prestación' : 'Sede'}</span>
                    <small>{currentRecords.filter((r) => r.unit_id === u.id).length} registros actuales · {data.actions.filter((a) => a.unit_id === u.id && !['resuelta','verificada'].includes(a.status)).length} acciones pendientes</small>
                  </button>)}</div>}
              </div>
              <div className="hys-panel">
                <div className="hys-panel-head"><div><h2>Estructura del legajo</h2><p>Los apartados aplicables dependen de cada establecimiento.</p></div></div>
                {!data.units.length && <p className="hys-note">Para cargar documentos en el legajo, primero creá un establecimiento desde «Añadir establecimiento». La documentación general se carga por separado.</p>}
                {data.units.length > 0 && <label className="hys-filter">Abrir legajo del establecimiento
                  <select value={overviewUnitId} onChange={e => setOverviewUnit(e.target.value)}>{data.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                </label>}
                <div className="hys-overview-sections">{visibleSectionsForUnit(overviewUnitId).map((s) => <button key={s.code} disabled={!overviewUnitId || !access(s.code, overviewUnitId)} onClick={() => {
                  go('unit', overviewUnitId)
                  setSection(s.code)
                }}>
                  <b>{s.number}</b><div><strong>{s.label}</strong><small>{s.categories.join(' · ')}</small></div>
                </button>)}</div>
              </div>
              <p className="hys-note">El porcentaje refleja únicamente documentos cargados con vencimiento. No equivale a una certificación de cumplimiento legal.</p>
            </>}
            {view === 'general' && renderRecords()}
            {view === 'unit' && <>
              <div className="hys-panel">
                <div className="hys-panel-head"><div><p className="eyebrow">ESTABLECIMIENTO</p><h2>{unitName(unitId)}</h2>
                  <p>Legajo de Higiene y Seguridad · {unitSections.length} apartados disponibles</p></div>
                  {isAdmin && <div className="hys-section-top-actions">
                    <button className="primary-button" type="button"
                      disabled={saving || data.sectionSettingsAvailable === false}
                      onClick={() => { setError(''); setSectionDraft({ code: '', label: '', enabled: true }) }}>
                      <Plus size={16}/> Agregar apartado
                    </button>
                    {sectionsForUnit(unitId).some(item => !item.enabled) && <button
                      className="hys-simple-action" type="button" disabled={saving}
                      onClick={() => setSectionsOpen(true)}><RotateCcw size={16}/> Recuperar eliminados</button>}
                  </div>}</div>
                {data.sectionSettingsAvailable === false && isAdmin && <p className="hys-config-warning">
                  Falta ejecutar el SQL de apartados por establecimiento. Los apartados originales siguen disponibles.
                </p>}
                {unitSections.length ? <div className="hys-section-grid">{unitSections.map((s) =>
                  <div key={s.code} className={'hys-section-card' + (section === s.code ? ' active' : '')}>
                    <button type="button" className="hys-section-open" onClick={() => {
                      setSection(s.code); setSelectedCategory(''); setFolderTrail([])
                    }}><b>{s.number}</b><span>{s.label}</span></button>
                    {isAdmin && data.sectionSettingsAvailable !== false && <div className="hys-section-card-actions">
                      <button className="hys-simple-action" type="button" disabled={saving}
                        aria-label={'Editar apartado ' + s.label}
                        onClick={() => { setError(''); setSectionDraft({ code: s.code, label: s.label, enabled: true }) }}>
                        <Pencil size={14}/> Editar</button>
                      <button className="hys-simple-action danger" type="button" disabled={saving}
                        aria-label={'Eliminar apartado ' + s.label}
                        onClick={() => { setError(''); setSectionToDelete(s) }}>
                        <Trash2 size={14}/> Eliminar</button>
                    </div>}
                  </div>)}</div> : <p className="hys-empty">No hay apartados habilitados para este establecimiento.
                  {isAdmin ? ' Podés recuperarlos desde «Recuperar eliminados» o agregar uno nuevo.' : ' Consultá con la administradora.'}</p>}
              </div>
              {section === 'actions' && unitSections.some(s => s.code === 'actions') && <button className="secondary-button" onClick={() => go('actions', unitId)}>Abrir plan de acción de esta sede</button>}
              {unitSections.length > 0 && renderRecords()}
            </>}
            {view === 'actions' && <>
              <div className="hys-panel">
                <div className="hys-panel-head"><div><h2>Plan de acción editable en línea</h2><p>Los cambios quedan guardados en el sistema y registrados en el historial.</p></div>
                  <div className="hys-actions-row">
                    <button className="secondary-button" onClick={async () => { try { await downloadActionsExcel(actions, unitName) } catch (e) { setError(errorText(e)) } }}><Download size={16}/> {actions.length ? 'Exportar Excel' : 'Plantilla Excel'}</button>
                     {canAddAction && <button className="secondary-button" onClick={() => { setImportAnalysis(null); setImportMapping({}); setImportSummary(null); setImportError(''); setImportOpen(true) }}><UploadCloud size={16}/> Importar Excel</button>}
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
                </tbody></table></div> : <div className="hys-empty hys-empty-actions"><p>Todavía no hay acciones cargadas. Creá la primera o descargá la plantilla Excel para importar varias juntas.</p>{canAddAction && <button className="primary-button" onClick={() => newAction()}>Crear primera acción</button>}</div>}
              </div>
              <div className="hys-panel"><h3>Evidencias vinculadas al plan</h3>
                {data.records.filter((r) => r.section === 'actions' && (!unitId || r.unit_id === unitId)).length === 0 ?
                  <p className="hys-empty">Todavía no se adjuntaron evidencias.</p> :
                  <div className="hys-doc-list">{data.records.filter((r) => r.section === 'actions' && (!unitId || r.unit_id === unitId)).map((r) =>
                    <article className="hys-doc" key={r.id}><FileText size={18}/><div className="hys-grow"><strong>{r.title}</strong><small>{r.category} · Versión {r.version_no}</small></div>
                      {fileButtons(r)}
                      {access('actions', r.unit_id, true) && !r.is_obsolete && !replaced.has(r.id) &&
                        <button className="hys-text-button" onClick={() => newRecord(r)}>Nueva versión</button>}
                    </article>)}</div>}
              </div>
            </>}
            {view === 'access' && isAdmin && <div className="hys-panel">
              <div className="hys-panel-head"><div><h2>Permisos específicos</h2><p>Habilitá solo el apartado y la sede que necesite cada persona.</p></div><LockKeyhole size={24}/></div>
              <form className="hys-form hys-grants-form" onSubmit={submitGrant}>
                <label>Persona<select required value={grantDraft.userId} onChange={(e) => setGrantDraft({ ...grantDraft, userId: e.target.value })}>
                  <option value="">Elegir usuario activo</option>{data.members.map((m) => <option value={m.user_id} key={m.user_id}>{m.user?.full_name || m.user?.email || m.user_id} ({m.role})</option>)}
                </select></label>
                <label>Apartado<select value={grantDraft.section} onChange={(e) => {
                  const custom = (data.sectionSettings || []).find(s => s.code === e.target.value && s.code.startsWith('custom_'))
                  setGrantDraft({ ...grantDraft, section: e.target.value, unitId: custom?.unit_id || '' })
                }}>
                  {HYS_ALL_SECTIONS.map((s) => <option value={s.code} key={s.code}>{s.number} · {s.label}</option>)}
                  {(data.sectionSettings || []).filter(s => s.is_active && s.code.startsWith('custom_'))
                    .map(s => <option key={s.code} value={s.code}>{unitName(s.unit_id)} · {s.label}</option>)}
                </select></label>
                <label>Alcance<select disabled={grantDraft.section === 'general' || grantDraft.section.startsWith('custom_')} value={grantDraft.unitId} onChange={(e) => setGrantDraft({ ...grantDraft, unitId: e.target.value })}>
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
                    <small>{(data.sectionSettings || []).find(s => s.code === g.section && s.unit_id === g.unit_id)?.label || sectionLabel(g.section)} · {g.unit_id ? unitName(g.unit_id) : 'Toda la empresa'} · {g.permission === 'edit' ? 'Edición' : 'Lectura'}</small></span>
                  <button className="hys-text-button" disabled={saving} onClick={() => run(() => removeHysGrant(g.id), 'Acceso revocado.')}>Revocar</button>
                </div>)}</div>}
              <p className="hys-note">Un permiso de HyS no concede acceso al SGI, a otras carpetas ni a otras empresas.</p>
            </div>}
          </>}
        </div>
      </div>


      {sectionsOpen && isAdmin && view === 'unit' && <div className="hys-overlay" role="presentation">
        <div className="hys-dialog hys-restore-dialog" role="dialog" aria-modal="true" aria-label="Recuperar apartados">
          <div className="hys-modal-title"><h2>Recuperar apartados</h2>
            <button type="button" aria-label="Cerrar" onClick={() => setSectionsOpen(false)}><X size={20}/></button></div>
          <p className="hys-note">Apartados eliminados de {unitName(unitId)}. Sus carpetas y documentos se conservaron.</p>
          <div className="hys-restore-list">{sectionsForUnit(unitId).filter(item => !item.enabled).map(item =>
            <div className="hys-restore-row" key={item.code}>
              <span>{item.label}</span>
              <button className="hys-simple-action" type="button" disabled={saving}
                onClick={() => toggleSection(item)}><RotateCcw size={15}/> Recuperar</button>
            </div>)}</div>
          {!sectionsForUnit(unitId).some(item => !item.enabled) && <p>No hay apartados para recuperar.</p>}
          {error && <p role="alert" className="hys-inline-error">{error}</p>}
        </div>
      </div>}
      {sectionToDelete && isAdmin && view === 'unit' && <div className="hys-overlay" role="presentation">
        <div className="hys-dialog hys-confirm-dialog" role="dialog" aria-modal="true" aria-label="Eliminar apartado">
          <div className="hys-modal-title"><h2>Eliminar apartado</h2>
            <button type="button" disabled={saving} aria-label="Cerrar" onClick={() => setSectionToDelete(null)}><X size={20}/></button></div>
          <p>¿Eliminar <strong>{sectionToDelete.label}</strong> de {unitName(unitId)}?</p>
          <p className="hys-note">Dejará de aparecer en esta sede, pero sus carpetas, documentos y registros se conservarán. Podés recuperarlo después.</p>
          <div className="hys-confirm-actions">
            <button type="button" className="secondary-button" disabled={saving} onClick={() => setSectionToDelete(null)}>Cancelar</button>
            <button type="button" className="hys-delete-confirm" disabled={saving}
              onClick={() => toggleSection(sectionToDelete)}><Trash2 size={15}/> {saving ? 'Eliminando…' : 'Eliminar apartado'}</button>
          </div>
          {error && <p role="alert" className="hys-inline-error">{error}</p>}
        </div>
      </div>}
      {sectionDraft && <div className="hys-overlay" role="presentation">
        <form className="hys-dialog" role="dialog" aria-modal="true"
          aria-label={sectionDraft.code ? 'Editar apartado' : 'Crear apartado'} onSubmit={submitSection}>
          <div className="hys-modal-title"><h2>{sectionDraft.code ? 'Editar apartado' : 'Nuevo apartado'}</h2>
            <button type="button" aria-label="Cerrar" onClick={() => { setSectionDraft(null); setSectionsOpen(false) }}><X size={20}/></button></div>
          <label>Nombre del apartado<input autoFocus required minLength={2} maxLength={100}
            value={sectionDraft.label} onChange={event => setSectionDraft({ ...sectionDraft, label: event.target.value })}/></label>
          <p className="hys-note">El cambio solo afecta a {unitName(unitId)}. Los archivos existentes se conservan.</p>
          {error && <p role="alert" className="hys-inline-error">{error}</p>}
          <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar apartado'}</button>
        </form>
      </div>}

      {folderDraft && <div className="hys-overlay" role="presentation">
        <form className="hys-dialog" role="dialog" aria-modal="true"
          aria-label={folderDraft.mode === 'delete' ? 'Eliminar carpeta' : folderDraft.mode === 'edit' ? 'Editar carpeta' : 'Crear carpeta'}
          onSubmit={folderDraft.mode === 'delete' ? (event) => { event.preventDefault(); confirmDeleteFolder() } : submitFolder}>
          <div className="hys-modal-title">
            <h2>{folderDraft.mode === 'delete' ? 'Eliminar carpeta' : folderDraft.mode === 'edit' ? 'Editar carpeta' : 'Nueva carpeta'}</h2>
            <button type="button" disabled={saving} aria-label="Cerrar" onClick={() => setFolderDraft(null)}><X size={20}/></button>
          </div>
          {folderDraft.mode === 'delete' ? <>
            <p>¿Querés eliminar <strong>{folderDraft.name}</strong>? No se borrarán documentos: únicamente se permite eliminar carpetas vacías.</p>
            {(() => {
              const docs = data.records.filter(r => r.section === folderDraft.section &&
                (r.unit_id || '') === (folderDraft.unitId || '') &&
                (r.category === folderDraft.category || r.category.startsWith(folderDraft.category + ' / '))).length
              const children = (data.folders || []).filter(f => f.section === folderDraft.section &&
                (f.unit_id || '') === (folderDraft.unitId || '') &&
                f.category !== folderDraft.category && f.category.startsWith(folderDraft.category + ' / ')).length
              return docs || children
                ? <p className="hys-inline-error" role="alert">Esta carpeta tiene {docs} documentos o registros y {children} subcarpetas. Movelos primero.</p>
                : <p className="hys-note">La carpeta está vacía y puede eliminarse.</p>
            })()}
            <button className="primary-button" disabled={saving || data.records.some(r =>
              r.section === folderDraft.section && (r.unit_id || '') === (folderDraft.unitId || '') &&
              (r.category === folderDraft.category || r.category.startsWith(folderDraft.category + ' / '))) ||
              (data.folders || []).some(f => f.section === folderDraft.section &&
                (f.unit_id || '') === (folderDraft.unitId || '') &&
                f.category !== folderDraft.category && f.category.startsWith(folderDraft.category + ' / '))}>
              Confirmar eliminación
            </button>
          </> : <>
            <label>Nombre de la {folderDraft.parentCategory ? 'subcarpeta' : 'carpeta'}
              <input autoFocus required maxLength={90} value={folderDraft.name}
                onChange={event => setFolderDraft({ ...folderDraft, name: event.target.value })}
                placeholder="Ej.: Certificados 2026"/>
            </label>
            <label>Ubicación
              <select value={folderDraft.parentCategory || ''} onChange={event =>
                setFolderDraft({ ...folderDraft, parentCategory: event.target.value })}>
                {folderParentOptions(folderDraft).map(option =>
                  <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <p className="hys-note">{folderDraft.id
              ? 'Podés renombrarla o moverla. Las referencias de los documentos se actualizan automáticamente.'
              : 'La carpeta se guarda inmediatamente, incluso sin documentos.'}</p>
            <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : folderDraft.id ? 'Guardar cambios' : 'Crear carpeta'}</button>
          </>}
          {error && <p role="alert" className="hys-inline-error">{error}</p>}
        </form>
      </div>}

      {preview && <HysFilePreview record={preview} onClose={() => setPreview(null)}/>}
      {showUnit && <div className="hys-overlay" role="presentation"><form className="hys-dialog" onSubmit={createUnit}>
        <div className="hys-modal-title"><h2>Nuevo establecimiento</h2><button type="button" onClick={() => setShowUnit(false)} aria-label="Cerrar"><X size={20}/></button></div>
        <label>Nombre del establecimiento<input required minLength={2} maxLength={160} value={unitDraft.name} onChange={(e) => setUnitDraft({ ...unitDraft, name: e.target.value })} placeholder="Ej.: Sede central, Obra norte, Planta 1"/></label>
        <label>Domicilio (opcional)<input value={unitDraft.address} onChange={(e) => setUnitDraft({ ...unitDraft, address: e.target.value })} placeholder="Ubicación de la sede"/></label>
        <label>Tipo<select value={unitDraft.kind} onChange={(e) => setUnitDraft({ ...unitDraft, kind: e.target.value })}><option value="sede">Sede</option><option value="obra">Obra</option><option value="prestacion">Lugar de prestación</option></select></label>
        {error && <p role="alert" className="hys-inline-error">{error}</p>}
        <button className="primary-button" disabled={saving}>Crear establecimiento</button>
      </form></div>}

      {importOpen && <div className="hys-overlay" role="presentation"><div className="hys-dialog hys-import-dialog" role="dialog" aria-modal="true" aria-label="Importar acciones desde Excel">
        <div className="hys-modal-title"><h2>Importar acciones desde Excel</h2><button type="button" disabled={importing} aria-label="Cerrar" onClick={() => setImportOpen(false)}><X size={20}/></button></div>
        <p className="hys-note">Elegí un Excel con acciones o hallazgos. Se detectan las hojas y encabezados automáticamente. No se modifican acciones ni documentos existentes.</p>
        <label>Archivo Excel (.xlsx o .xls)<input type="file" accept=".xlsx,.xls" disabled={importing} onChange={selectActionsExcel}/></label>
        {importError && <p role="alert" className="hys-inline-error">{importError}</p>}
        {importAnalysis && <>
          <p className="hys-note"><strong>Hoja detectada:</strong> {importAnalysis.sheetName} · Encabezados en la fila {importAnalysis.headerRow}</p>
          <h3>Correspondencia de columnas</h3>
          <div className="hys-import-mapping">
            {HYS_IMPORT_MAPPING_FIELDS.map(field => <label key={field.key}>{field.label}
              <select disabled={importing || Boolean(importSummary)} value={importMapping[field.key] ?? -1}
                onChange={event => { setImportSummary(null); setImportMapping(current => ({ ...current, [field.key]: Number(event.target.value) })) }}>
                <option value={-1}>Sin columna {field.key === 'status' ? '(Pendiente)' : ''}</option>
                {importAnalysis.headers.map((header, index) => <option key={index} value={index}>
                  {header || 'Columna ' + (index + 1)}
                </option>)}
              </select>
            </label>)}
          </div>
          {!importSummary && <>
            <h3>Vista previa · {importPlan?.rows.length || 0} para importar, {importPlan?.skipped.length || 0} omitidas</h3>
            <div className="hys-table-wrap hys-import-table"><table className="hys-table"><thead><tr>
              <th>Fila</th><th>Acción</th><th>Sede</th><th>Responsable</th><th>Prioridad</th><th>Estado</th><th>Plazo</th><th>Detección</th>
            </tr></thead><tbody>
              {importPlan?.rows.map(row => <tr key={row.rowNumber}>
                <td>{row.rowNumber}</td><td>{row.values.title}</td>
                <td>{row.unitId ? unitName(row.unitId) : 'General'}</td>
                <td>{row.values.responsible || 'Sin asignar'}</td>
                <td>{HYS_PRIORITIES[row.values.priority]}</td><td>{HYS_STATES[row.values.status]}</td>
                <td>{row.values.due_date || '—'}</td><td>{row.values.detection_date || '—'}</td>
              </tr>)}
            </tbody></table></div>
            {(importPlan?.skipped.length || 0) > 0 && <details className="hys-import-skipped">
              <summary>Ver las {importPlan.skipped.length} filas omitidas y sus motivos</summary>
              <ul>{importPlan.skipped.map(item => <li key={item.rowNumber}>Fila {item.rowNumber}: {item.reason}</li>)}</ul>
            </details>}
            {importPlan?.rows.length > 0 && <button type="button" className="primary-button" disabled={importing}
              onClick={confirmActionsImport}>{importing ? 'Importando…' : 'Confirmar ' + importPlan.rows.length + ' acciones'}</button>}
            {importPlan?.rows.length === 0 && <p className="hys-note">No hay acciones válidas nuevas con este mapeo y filtro. Revisá las filas omitidas o corregí las columnas.</p>}
          </>}
          {importSummary && <div className="hys-import-result" role="status">
            <h3>Resultado de la importación</h3>
            <p><strong>{importSummary.imported} importadas</strong> · <strong>{importSummary.skipped.length} omitidas</strong></p>
            {importSummary.skipped.length > 0 && <details open className="hys-import-skipped">
              <summary>Motivos de omisión</summary>
              <ul>{importSummary.skipped.map(item => <li key={item.rowNumber}>Fila {item.rowNumber}: {item.reason}</li>)}</ul>
            </details>}
            <button type="button" className="secondary-button" onClick={() => setImportOpen(false)}>Cerrar resumen</button>
          </div>}
        </>}
      </div></div>}

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
        {error && <p role="alert" className="hys-inline-error">{error}</p>}
        <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar acción'}</button>
      </form></div>}

      {recordDraft && <div className="hys-overlay" role="presentation"><form className="hys-dialog" onSubmit={submitRecord}>
        <div className="hys-modal-title"><h2>{recordDraft.supersedesId ? 'Nueva versión' : 'Nuevo registro documental'}</h2><button type="button" onClick={() => setRecordDraft(null)} aria-label="Cerrar"><X size={20}/></button></div>
        <p className="hys-note">{sectionsForUnit(recordDraft.unitId).find(s => s.code === recordDraft.section)?.label || sectionLabel(recordDraft.section)}{recordDraft.versionNo > 1 ? ' · Versión ' + recordDraft.versionNo : ''}</p>
        <label>Subapartado<select value={recordDraft.category} disabled={Boolean(recordDraft.supersedesId) || recordDraft.section === 'general'} onChange={(e) => setRecordDraft({ ...recordDraft, category: e.target.value })}>
          {[...new Set([...(recordDraft.section === 'general' ? [] : sectionsForUnit(recordDraft.unitId).find(s => s.code === recordDraft.section)?.categories || []), recordDraft.category])].map((s) => <option key={s} value={s}>{s}</option>)}
        </select></label>
        <label>Título<input required maxLength={180} minLength={2} value={recordDraft.title} onChange={(e) => setRecordDraft({ ...recordDraft, title: e.target.value })}/></label>
        <label>Observaciones<textarea rows={3} value={recordDraft.notes} onChange={(e) => setRecordDraft({ ...recordDraft, notes: e.target.value })}/></label>
        <div className="hys-form-grid">
          <label>Fecha del registro<input type="date" value={recordDraft.recorded_at} onChange={(e) => setRecordDraft({ ...recordDraft, recorded_at: e.target.value })}/></label>
          <label>Vencimiento (opcional)<input type="date" value={recordDraft.expires_at} onChange={(e) => setRecordDraft({ ...recordDraft, expires_at: e.target.value })}/></label>
        </div>
        <label>Archivo {recordDraft.requireFile ? '(obligatorio)' : '(opcional para registros sin adjunto)'}
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
            required={Boolean(recordDraft.requireFile)} onChange={(e) => {
              const file = e.target.files?.[0] || null
              setRecordFile(file)
              setRecordError(file && file.size > 25 * 1024 * 1024 ? 'El archivo supera el máximo de 25 MB.' : '')
            }}/></label>
        {recordFile && <p className="hys-file-summary">Seleccionado: {recordFile.name} · {(recordFile.size / 1024 / 1024).toFixed(2)} MB</p>}
        {recordError && <p className="hys-inline-error" role="alert">{recordError}</p>}
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
