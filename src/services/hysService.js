import { requireSupabase } from '../lib/supabase'
import { HYS_STATES, HYS_PRIORITIES, HYS_ALL_SECTIONS, GENERAL_CATEGORIES, hysConfiguredSections } from '../lib/hysCatalog'

const BUCKET = 'hys-files'
const MAX_SIZE = 25 * 1024 * 1024
const FILE_TYPES = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv', txt: 'text/plain',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
}

const trim = (value) => String(value ?? '').trim()
const dateOrNull = (value) => trim(value) || null

export function normalizeHysAction(values) {
  const title = trim(values.title)
  if (title.length < 3 || title.length > 180) throw new Error('La acción debe tener entre 3 y 180 caracteres.')
  if (!Object.hasOwn(HYS_STATES, values.status)) throw new Error('Estado inválido.')
  if (!Object.hasOwn(HYS_PRIORITIES, values.priority)) throw new Error('Prioridad inválida.')
  return {
    title,
    description: trim(values.description),
    responsible: trim(values.responsible),
    priority: values.priority,
    status: values.status,
    due_date: dateOrNull(values.due_date),
    ...(values.detection_date !== undefined ? { detection_date: dateOrNull(values.detection_date) } : {}),
  }
}

async function rows(query) {
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function allPages(query) {
  const all = []
  for (let offset = 0; ; offset += 1000) {
    const page = await rows(query.range(offset, offset + 999))
    all.push(...page)
    if (page.length < 1000) break
  }
  return all
}

export function isMissingHysCompanyDetails(error) {
  const message = String(error?.message || '')
  return ((error?.code === '42P01' || error?.code === 'PGRST205')
    && /hys_company_details/i.test(message))
    || /(?:could not find the table|relation .* does not exist).*hys_company_details/i.test(message)
}

export function isPreviewableHysFile(name = '') {
  return /\.(?:pdf|png|jpe?g|webp)$/i.test(String(name))
}

export function isMissingHysFolders(error) {
  const message = String(error?.message || '')
  return (error?.code === '42P01' || error?.code === 'PGRST205')
    && /hys_folders/i.test(message)
}

export function isMissingHysUnitSections(error) {
  const message = String(error?.message || '')
  return (error?.code === '42P01' || error?.code === 'PGRST205') && /hys_unit_sections/i.test(message)
}

export async function saveHysUnitSection({ companyId, unitId, code, label, enabled = true }) {
  const clean = trim(label)
  if (clean.length < 2 || clean.length > 100) throw new Error('El apartado debe tener entre 2 y 100 caracteres.')
  if (!unitId) throw new Error('Seleccioná un establecimiento.')
  const fixed = HYS_ALL_SECTIONS.some(s => s.code === code && code !== 'general')
  if (!fixed && !/^custom_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(code || '')) {
    throw new Error('Código de apartado inválido.')
  }
  const { data, error } = await requireSupabase().from('hys_unit_sections')
    .upsert({ company_id: companyId, unit_id: unitId, code, label: clean, is_active: enabled },
      { onConflict: 'company_id,unit_id,code' }).select().single()
  if (error) throw error
  return data
}

export async function loadHys({ companyId, isAdmin }) {
  const db = requireSupabase()
  const [units, actions, records, grants, members, companyDetailsResult, folderResult, sectionsResult] = await Promise.all([
    allPages(db.from('hys_units').select('*').eq('company_id', companyId).order('name').order('id')),
    allPages(db.from('hys_actions').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).order('id')),
    allPages(db.from('hys_records').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).order('id')),
    allPages(db.from('hys_grants').select('*').eq('company_id', companyId).order('id')),
    isAdmin ? allPages(db.from('company_members').select('user_id, role, hys_only, user:profiles(id,full_name,email)').eq('company_id', companyId).eq('is_active', true).order('user_id')) : Promise.resolve([]),
    db.from('hys_company_details').select('*').eq('company_id', companyId).maybeSingle(),
    allPages(db.from('hys_folders').select('*').eq('company_id', companyId).order('created_at').order('id'))
      .then(folders => ({ folders, available: true }))
      .catch(error => {
        if (isMissingHysFolders(error)) return { folders: [], available: false }
        throw error
      }),
    allPages(db.from('hys_unit_sections').select('*').eq('company_id', companyId).order('created_at').order('id'))
      .then(sections => ({ sections, available: true }))
      .catch(error => {
        if (isMissingHysUnitSections(error)) return { sections: [], available: false }
        throw error
      }),
  ])
  const companyDetailsAvailable = !isMissingHysCompanyDetails(companyDetailsResult.error)
  if (companyDetailsResult.error && companyDetailsAvailable) throw companyDetailsResult.error
  return {
    units, actions, records, grants, members, folders: folderResult.folders, foldersAvailable: folderResult.available,
    sectionSettings: sectionsResult.sections, sectionSettingsAvailable: sectionsResult.available,
    companyDetails: companyDetailsAvailable ? companyDetailsResult.data : null,
    companyDetailsAvailable,
  }
}

export function normalizeHysFolder({ name, parentCategory = null }) {
  const clean = trim(name)
  if (!clean || clean.length > 90) throw new Error('El nombre debe tener entre 1 y 90 caracteres.')
  if (clean.includes('/') || clean.includes(String.fromCharCode(92))) throw new Error('El nombre no puede contener barras.')
  const parent = parentCategory || null
  const category = parent ? parent + (/^\d{2} \/ $/.test(parent) ? '' : ' / ') + clean : clean
  if (category.length > 160) throw new Error('La ruta de la carpeta no puede superar 160 caracteres.')
  return { name: clean, parentCategory: parent, category }
}

export async function saveHysFolder({ companyId, unitId, section, name, parentCategory, id }) {
  const values = normalizeHysFolder({ name, parentCategory })
  const db = requireSupabase()
  // Resolve the same per-site catalog used by navigation before reserving names.
  let reserved = GENERAL_CATEGORIES
  if (section !== 'general') {
    const { data: settings, error } = await db.from('hys_unit_sections').select('*')
      .eq('company_id', companyId).eq('unit_id', unitId)
    if (error && !isMissingHysUnitSections(error)) throw error
    reserved = hysConfiguredSections(settings || [], unitId, companyId)
      .find(item => item.code === section)?.categories || []
  }
  if (reserved.some(category => category.toLocaleLowerCase('es') === values.category.toLocaleLowerCase('es'))) {
    throw new Error('Este subapartado pertenece a la matriz fija. Elegí otro nombre.')
  }
  const { data, error } = id
    ? await db.rpc('hys_update_folder', {
      p_id: id, p_parent_category: values.parentCategory, p_name: values.name,
    })
    : await db.rpc('hys_create_folder', {
      p_company: companyId, p_unit: unitId || null, p_section: section,
      p_parent_category: values.parentCategory, p_name: values.name,
    })
  if (error?.code === '23505') throw new Error('Ya existe una carpeta con ese nombre en esta ubicación.')
  if (error) throw error
  return data
}

export async function deleteHysFolder(id) {
  const { error } = await requireSupabase().rpc('hys_delete_folder', { p_id: id })
  if (error) throw error
}

export async function addHysUnit({ companyId, name, kind, address }) {
  const db = requireSupabase()
  const { data, error } = await db.from('hys_units').insert({ company_id: companyId, name: trim(name), kind, address: trim(address) || null }).select().single()
  if (error) throw error
  return data
}

export function normalizeHysCompanyDetails(values = {}) {
  const cuit = String(values.cuit || '').replace(/[-\s]/g, '') || null
  if (cuit && !/^\d{11}$/.test(cuit)) throw new Error('El CUIT debe tener 11 dígitos.')
  const legal_name = trim(values.legal_name)
  if (legal_name.length > 180) throw new Error('La razón social no puede superar 180 caracteres.')
  return {
    legal_name, cuit,
    activity: trim(values.activity),
    art_provider: trim(values.art_provider),
  }
}

export async function saveHysCompanyDetails({ companyId, values }) {
  const { data, error } = await requireSupabase().from('hys_company_details')
    .upsert({ company_id: companyId, ...normalizeHysCompanyDetails(values) }, { onConflict: 'company_id' })
    .select().single()
  if (error) throw error
  return data
}

export async function saveHysAction({ companyId, unitId, userId, values, existing, importKey }) {
  const db = requireSupabase()
  const clean = normalizeHysAction(values)
  if (existing) {
    const { data, error } = await db.from('hys_actions').update(clean)
      .eq('id', existing.id).eq('company_id', companyId).eq('version', existing.version).select().maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Otra persona modificó esta acción. Actualizá la página antes de volver a guardar.')
    return data
  }
  const { data, error } = await db.from('hys_actions').insert({
    ...clean, company_id: companyId, unit_id: unitId || null, created_by: userId,
    ...(importKey ? { import_key: importKey } : {}),
  }).select().single()
  if (error?.code === '23505' && importKey && /hys_actions_import_key_uniq/.test(error.message || '')) return { duplicate: true }
  if (error) throw error
  return data
}

export async function setHysRecordObsolete(id) {
  const { data, error } = await requireSupabase().from('hys_records')
    .update({ is_obsolete: true }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function setHysOnly({ companyId, userId, enabled }) {
  const { data, error } = await requireSupabase().from('company_members')
    .update({ hys_only: enabled }).eq('company_id', companyId)
    .eq('user_id', userId).eq('role', 'member').select('user_id, hys_only').single()
  if (error) throw error
  return data
}

export async function listHysHistory({ companyId, actionId }) {
  const db = requireSupabase()
  return allPages(db.from('hys_action_history').select('id, event, actor_id, details, created_at')
    .eq('company_id', companyId).eq('action_id', actionId).order('created_at', { ascending: false }).order('id', { ascending: false }))
}

export async function saveHysGrant({ companyId, userId, unitId, section, permission, actorId }) {
  const db = requireSupabase()
  const payload = {
    company_id: companyId, user_id: userId, unit_id: unitId || null,
    section, permission, granted_by: actorId,
  }
  const { data, error } = await db.from('hys_grants').upsert(payload, {
    onConflict: 'company_id,user_id,section,unit_id',
  }).select().single()
  if (error) throw error
  return data
}

export async function removeHysGrant(id) {
  const { error } = await requireSupabase().from('hys_grants').delete().eq('id', id)
  if (error) throw error
}

function safeFilename(value) {
  return trim(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || 'adjunto'
}

export async function createHysRecord({ companyId, unitId, userId, values, file }) {
  const db = requireSupabase()
  if (file && (!file.size || file.size > MAX_SIZE)) throw new Error('El archivo debe ser válido y pesar menos de 25 MB.')
  const extension = file?.name?.split('.').pop()?.toLowerCase()
  if (file && !Object.hasOwn(FILE_TYPES, extension)) {
    throw new Error('Solo se admiten PDF, Word, Excel, CSV, TXT e imágenes JPG, PNG o WEBP.')
  }
  const title = trim(values.title)
  if (title.length < 2 || title.length > 180) throw new Error('Ingresá un título de 2 a 180 caracteres.')
  // A given revision has one successor even if two editors submit concurrently.
  let id = crypto.randomUUID()
  if (values.supersedesId) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hys-version/' + values.supersedesId))
    const bytes = new Uint8Array(digest, 0, 16)
    bytes[6] = (bytes[6] & 0x0f) | 0x80
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    id = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
  }
  const path = file ? `${companyId}/${id}/${Date.now()}-${safeFilename(file.name)}` : null
  const payload = {
    id, company_id: companyId, unit_id: unitId || null, created_by: userId,
    section: values.section, category: values.category,
    title, notes: trim(values.notes),
    recorded_at: dateOrNull(values.recorded_at),
    expires_at: dateOrNull(values.expires_at),
    file_name: file?.name || null, file_path: path, file_size: file?.size || null,
    action_id: values.actionId || null,
    supersedes_id: values.supersedesId || null,
    version_no: values.versionNo || 1,
  }
  const { data, error } = await db.from('hys_records').insert(payload).select().single()
  if (error?.code === '23505' && values.supersedesId) throw new Error('Ya existe una nueva versión. Actualizá el legajo antes de volver a cargarla.')
  if (error) throw error
  if (!file) return data
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, {
    upsert: false, contentType: FILE_TYPES[extension],
  })
  if (uploadError) {
    const { error: cleanupError } = await db.from('hys_records').delete().eq('id', id)
    if (cleanupError) {
      throw new Error('No se pudo subir el archivo y tampoco revertir el registro incompleto. Avisá al administrador. ' + uploadError.message)
    }
    throw uploadError
  }
  return data
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadHysFile(record) {
  const { data, error } = await requireSupabase().storage.from(BUCKET).download(record.file_path)
  if (error) throw error
  downloadBlob(data, record.file_name || 'documento')
}

// Importa hallazgos de planillas externas sin tocar documentos ni acciones existentes.
const HYS_IMPORT_FIELDS = [
  { key: 'title', label: 'Acción', aliases: ['accion', 'hallazgo situacion', 'hallazgo', 'situacion', 'hallazgo detectado'] },
  { key: 'unitId', label: 'Establecimiento', aliases: ['establecimiento', 'sede', 'centro de trabajo', 'ubicacion'] },
  { key: 'responsible', label: 'Responsable', aliases: ['responsable', 'responsable accion', 'responsable de la accion'] },
  { key: 'projectManager', label: 'Responsable alternativo', aliases: ['project manager', 'pm', 'jefe de proyecto'] },
  { key: 'priority', label: 'Prioridad', aliases: ['prioridad', 'nivel de prioridad'] },
  { key: 'status', label: 'Estado', aliases: ['estado', 'estatus', 'status'] },
  { key: 'due_date', label: 'Plazo', aliases: ['vencimiento', 'plazo', 'compromiso fecha', 'fecha compromiso', 'fecha limite', 'fecha de compromiso'] },
  { key: 'detection_date', label: 'Fecha de detección', aliases: ['deteccion', 'fecha deteccion', 'fecha de deteccion'] },
  { key: 'description', label: 'Descripción adicional', aliases: ['descripcion', 'observaciones', 'detalle'] },
]
export const HYS_IMPORT_MAPPING_FIELDS = HYS_IMPORT_FIELDS.map(({ key, label }) => ({ key, label }))
const canonImport = value => trim(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
const headerMapping = headers => Object.fromEntries(HYS_IMPORT_FIELDS.map(field => [
  field.key, headers.findIndex(header => field.aliases.includes(canonImport(header))),
]))
const cellImport = (row, mapping, field) => {
  const index = mapping[field]
  return Number.isInteger(index) && index >= 0 ? row[index] : ''
}
const dateImport = (raw, ssf) => {
  if (raw === '' || raw == null) return null
  let y, m, d
  if (raw instanceof Date) [y, m, d] = [raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate()]
  else if (typeof raw === 'number') {
    const parsed = ssf.parse_date_code(raw)
    if (!parsed) throw new Error('fecha inválida')
    ;[y, m, d] = [parsed.y, parsed.m, parsed.d]
  } else {
    const input = trim(raw).replace(/\s+\d{1,2}:\d{2}(?::\d{2})?$/, '')
    let parts = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (parts) [y, m, d] = parts.slice(1).map(Number)
    else {
      parts = input.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
      if (!parts) throw new Error('fecha inválida (usá DD/MM/AAAA)')
      ;[d, m, y] = parts.slice(1).map(Number)
    }
  }
  const check = new Date(Date.UTC(y, m - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== m || check.getUTCDate() !== d) throw new Error('fecha inválida')
  return [String(y).padStart(4, '0'), String(m).padStart(2, '0'), String(d).padStart(2, '0')].join('-')
}
const enumImport = (raw, options, fallback, label) => {
  if (!trim(raw)) return fallback
  const canonical = canonImport(raw)
  const synonyms = label === 'Prioridad' ? { alto: 'alta', medio: 'media', bajo: 'baja', critico: 'critica' } : {}
  const found = Object.entries(options).find(([key, value]) => canonImport(key) === canonical || canonImport(value) === canonical)
  const key = found?.[0] || synonyms[canonical]
  if (!key || !Object.hasOwn(options, key)) throw new Error(label + ' inválida: «' + raw + '»')
  return key
}
const hysActionIdentity = (unitId, title, date) =>
  [unitId || '', canonImport(title), date || ''].join('|')

export async function inspectHysActionsWorkbook(file) {
  if (!/\.(xls|xlsx)$/i.test(file?.name || '') || !file.size || file.size > 5 * 1024 * 1024) {
    throw new Error('Seleccioná un Excel .xlsx o .xls de hasta 5 MB.')
  }
  const { read, utils, SSF } = await import('xlsx')
  const book = read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  let best = null
  for (const name of book.SheetNames) {
    if (/^(tablero|dashboard|indicadores?|kpis?|resumen de indicadores)$/i.test(canonImport(name))) continue
    const sheet = book.Sheets[name]
    if (!sheet?.['!ref']) continue
    const offset = utils.decode_range(sheet['!ref']).s.r
    const grid = utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: true })
    for (let index = 0; index < Math.min(grid.length, 100); index++) {
      const headers = (grid[index] || []).map(trim)
      const mapping = headerMapping(headers)
      const matching = HYS_IMPORT_FIELDS.filter(field => mapping[field.key] >= 0)
      if (mapping.title < 0 || matching.length < 2) continue
      const sample = grid.slice(index + 1, index + 21)
        .filter(row => trim(cellImport(row || [], mapping, 'title'))).length
      const score = matching.length * 10 + Math.min(sample, 10) +
        (canonImport(name) === 'plan de accion' ? 1 : 0)
      if (!best || score > best.score) {
        best = { sheetName: name, headerRow: offset + index + 1, headers, grid, offset, mapping, ssf: SSF, score }
      }
    }
  }
  if (!best) throw new Error('No encontré una tabla de acciones o hallazgos. Revisá el Excel o elegí una hoja que contenga «Hallazgo / situación» o «Acción».')
  const { score, ...analysis } = best
  return analysis
}

export function previewHysActionsWorkbook(analysis, {
  mapping = analysis.mapping, units = [], defaultUnitId = '', canEdit = () => false, existingActions = [],
} = {}) {
  const rows = [], skipped = [], seen = new Set()
  const selectedUnit = defaultUnitId || ''
  const existing = new Set(existingActions.map(action =>
    hysActionIdentity(action.unit_id, action.title, action.due_date)))
  for (let i = analysis.headerRow - analysis.offset; i < analysis.grid.length; i++) {
    const rawRow = analysis.grid[i] || []
    if (!rawRow.some(value => trim(value))) continue
    const rowNumber = analysis.offset + i + 1
    const skip = reason => skipped.push({ rowNumber, reason })
    const hallazgo = trim(cellImport(rawRow, mapping, 'title'))
    if (!hallazgo) { skip('Sin hallazgo o acción'); continue }
    try {
      const name = canonImport(cellImport(rawRow, mapping, 'unitId'))
      let unitId = selectedUnit
      if (name === 'general' || name === 'empresa') unitId = ''
      else if (name) {
        const found = units.filter(unit => canonImport(unit.name) === name)
        if (found.length !== 1) { skip('Establecimiento inexistente o ambiguo: ' + cellImport(rawRow, mapping, 'unitId')); continue }
        unitId = found[0].id
      }
      if (selectedUnit && unitId !== selectedUnit) { skip('Fuera del establecimiento seleccionado'); continue }
      if (!canEdit(unitId)) { skip('Sin permiso para editar este establecimiento'); continue }
      const due_date = dateImport(cellImport(rawRow, mapping, 'due_date'), analysis.ssf)
      const detection_date = dateImport(cellImport(rawRow, mapping, 'detection_date'), analysis.ssf)
      const title = hallazgo.slice(0, 180).trim()
      const extra = trim(cellImport(rawRow, mapping, 'description'))
      const description = [hallazgo.length > 180 ? hallazgo : '', extra].filter(Boolean).join('\n')
      const values = normalizeHysAction({
        title, description,
        responsible: trim(cellImport(rawRow, mapping, 'responsible')) ||
          trim(cellImport(rawRow, mapping, 'projectManager')),
        priority: enumImport(cellImport(rawRow, mapping, 'priority'), HYS_PRIORITIES, 'media', 'Prioridad'),
        status: enumImport(cellImport(rawRow, mapping, 'status'), HYS_STATES, 'pendiente', 'Estado'),
        due_date,
        detection_date,
      })
      const identity = hysActionIdentity(unitId, values.title, values.due_date)
      if (seen.has(identity) || existing.has(identity)) { skip('Acción duplicada'); continue }
      if (rows.length >= 500) { skip('Supera el límite de 500 acciones por importación'); continue }
      seen.add(identity)
      rows.push({ rowNumber, unitId, values })
    } catch (error) {
      skip(error.message || 'Fila inválida')
    }
  }
  return { rows, skipped }
}

// Se conserva la firma anterior para integraciones que importan la plantilla de GESTIQA.
export async function parseHysActionsWorkbook(file, options = {}) {
  const analysis = await inspectHysActionsWorkbook(file)
  const { rows, skipped } = previewHysActionsWorkbook(analysis, options)
  if (!rows.length) {
    const first = skipped[0]
    if (!first) throw new Error('No hay acciones para importar.')
    if (first.reason.startsWith('Sin permiso')) throw new Error('Fila ' + first.rowNumber + ': no tenés permiso para editar ese establecimiento.')
    if (first.reason.startsWith('Establecimiento inexistente')) throw new Error('Fila ' + first.rowNumber + ': el establecimiento no existe o es ambiguo.')
    throw new Error('Fila ' + first.rowNumber + ': ' + first.reason)
  }
  return rows.map(row => {
    const { detection_date, ...other } = row.values
    return { ...row, values: analysis.mapping.detection_date < 0 ? other : { ...other, detection_date } }
  })
}

export async function hysActionImportKey(companyId, row) {
  const value = [companyId, row.unitId || '', canonImport(row.values.title), row.values.due_date || '']
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function buildActionsExcel(actions, unitName = () => 'General') {
  const { utils, write } = await import('xlsx')
  const header = ['Acción', 'Establecimiento', 'Responsable', 'Prioridad', 'Estado', 'Vencimiento', 'Descripción', 'Detección']
  const rows = [header, ...actions.map((a) => [
    a.title, a.unit_id ? unitName(a.unit_id) : 'General',
    a.responsible, HYS_PRIORITIES[a.priority], HYS_STATES[a.status], a.due_date || '', a.description, a.detection_date || '',
  ])]
  const book = utils.book_new()
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), 'Plan de acción')
  return write(book, { type: 'array', bookType: 'xlsx' })
}
export async function downloadActionsExcel(actions, unitName) {
  const blob = new Blob([await buildActionsExcel(actions, unitName)], { type: FILE_TYPES.xlsx })
  downloadBlob(blob, actions.length ? 'Plan-de-accion-HyS.xlsx' : 'Plantilla-Plan-de-accion-HyS.xlsx')
}

export function canUseHys({ isAdmin, grants, section, unitId, write = false }) {
  if (isAdmin) return true
  return grants.some((g) => g.section === section &&
    (!write || g.permission === 'edit') &&
    (g.unit_id === null || (unitId != null && g.unit_id === unitId)))
}
