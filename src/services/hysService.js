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

export async function loadHys({ companyId, isAdmin }) {
  const db = requireSupabase()
  const [units, actions, records, grants, members, companyDetailsResult] = await Promise.all([
    rows(db.from('hys_units').select('*').eq('company_id', companyId).order('name')),
    allPages(db.from('hys_actions').select('*').eq('company_id', companyId).order('created_at', { ascending: false })),
    allPages(db.from('hys_records').select('*').eq('company_id', companyId).order('created_at', { ascending: false })),
    allPages(db.from('hys_grants').select('*').eq('company_id', companyId)),
    isAdmin ? rows(db.from('company_members').select('user_id, role, hys_only, user:profiles(id,full_name,email)').eq('company_id', companyId).eq('is_active', true)) : Promise.resolve([]),
    db.from('hys_company_details').select('*').eq('company_id', companyId).maybeSingle(),
  ])
  if (companyDetailsResult.error) throw companyDetailsResult.error
  return { units, actions, records, grants, members, companyDetails: companyDetailsResult.data }
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
  return rows(db.from('hys_action_history').select('id, event, actor_id, details, created_at')
    .eq('company_id', companyId).eq('action_id', actionId).order('created_at', { ascending: false }).limit(50))
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
  const id = crypto.randomUUID()
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
  if (error) throw error
  if (!file) return data
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, {
    upsert: false, contentType: FILE_TYPES[extension],
  })
  if (uploadError) {
    await db.from('hys_records').delete().eq('id', id)
    throw uploadError
  }
  return data
}

export async function openHysFile(path) {
  if (!path) return
  // Open the tab synchronously to avoid mobile popup blockers after await.
  const tab = window.open('', '_blank')
  try {
    const { data, error } = await requireSupabase().storage.from(BUCKET).createSignedUrl(path, 60)
    if (error) throw error
    if (tab) tab.location.href = data.signedUrl
    else window.location.assign(data.signedUrl)
  } catch (error) {
    tab?.close()
    throw error
  }
}

function escapeXml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
export function buildActionsExcel(actions, unitName = () => 'General') {
  const header = ['Acción', 'Establecimiento', 'Responsable', 'Prioridad', 'Estado', 'Vencimiento', 'Descripción']
  const rows = [header, ...actions.map((a) => [
    a.title, a.unit_id ? unitName(a.unit_id) : 'General',
    a.responsible, HYS_PRIORITIES[a.priority], HYS_STATES[a.status], a.due_date || '', a.description,
  ])]
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Plan de accion"><Table>' +
    rows.map((cells) => '<Row>' + cells.map((value) => '<Cell><Data ss:Type="String">' + escapeXml(value) + '</Data></Cell>').join('') + '</Row>').join('') +
    '</Table></Worksheet></Workbook>'
}
export function downloadActionsExcel(actions, unitName) {
  const blob = new Blob([buildActionsExcel(actions, unitName)], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'Plan-de-accion-HyS.xls'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function canUseHys({ isAdmin, grants, section, unitId, write = false }) {
  if (isAdmin) return true
  return grants.some((g) => g.section === section &&
    (!write || g.permission === 'edit') &&
    (g.unit_id === null || (unitId != null && g.unit_id === unitId)))
}
