import { requireSupabase } from '../lib/supabase'
import { HYS_STATES, HYS_PRIORITIES } from '../lib/hysCatalog'

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

export async function loadHys({ companyId, isAdmin }) {
  const db = requireSupabase()
  const [units, actions, records, grants, members, companyDetailsResult] = await Promise.all([
    allPages(db.from('hys_units').select('*').eq('company_id', companyId).order('name').order('id')),
    allPages(db.from('hys_actions').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).order('id')),
    allPages(db.from('hys_records').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).order('id')),
    allPages(db.from('hys_grants').select('*').eq('company_id', companyId).order('id')),
    isAdmin ? allPages(db.from('company_members').select('user_id, role, hys_only, user:profiles(id,full_name,email)').eq('company_id', companyId).eq('is_active', true).order('user_id')) : Promise.resolve([]),
    db.from('hys_company_details').select('*').eq('company_id', companyId).maybeSingle(),
  ])
  const companyDetailsAvailable = !isMissingHysCompanyDetails(companyDetailsResult.error)
  if (companyDetailsResult.error && companyDetailsAvailable) throw companyDetailsResult.error
  return {
    units, actions, records, grants, members,
    companyDetails: companyDetailsAvailable ? companyDetailsResult.data : null,
    companyDetailsAvailable,
  }
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

export async function saveHysAction({ companyId, unitId, userId, values, existing }) {
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
  }).select().single()
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

export async function buildActionsExcel(actions, unitName = () => 'General') {
  const { utils, write } = await import('xlsx')
  const header = ['Acción', 'Establecimiento', 'Responsable', 'Prioridad', 'Estado', 'Vencimiento', 'Descripción']
  const rows = [header, ...actions.map((a) => [
    a.title, a.unit_id ? unitName(a.unit_id) : 'General',
    a.responsible, HYS_PRIORITIES[a.priority], HYS_STATES[a.status], a.due_date || '', a.description,
  ])]
  const book = utils.book_new()
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), 'Plan de acción')
  return write(book, { type: 'array', bookType: 'xlsx' })
}
export async function downloadActionsExcel(actions, unitName) {
  const blob = new Blob([await buildActionsExcel(actions, unitName)], { type: FILE_TYPES.xlsx })
  downloadBlob(blob, 'Plan-de-accion-HyS.xlsx')
}

export function canUseHys({ isAdmin, grants, section, unitId, write = false }) {
  if (isAdmin) return true
  return grants.some((g) => g.section === section &&
    (!write || g.permission === 'edit') &&
    (g.unit_id === null || (unitId != null && g.unit_id === unitId)))
}
