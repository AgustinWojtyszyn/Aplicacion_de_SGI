import { requireSupabase } from '../lib/supabase'

function cleanSearch(value = '') {
  return String(value).replace(/[,%()]/g, ' ').trim()
}

function numberValue(value, label) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label} debe ser un número válido.`)
  return parsed
}

export function normalizeWorkEntry(values = {}) {
  const workDate = String(values.workDate || '').trim()
  const location = String(values.location || '').trim()
  const description = String(values.description || '').trim()
  const hours = numberValue(values.hours, 'Las horas')
  const cost = numberValue(values.cost ?? 0, 'El costo')
  const amount = numberValue(values.amount ?? 0, 'El monto')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) throw new Error('Seleccioná una fecha válida.')
  if (location.length < 2) throw new Error('Ingresá una ubicación de al menos 2 caracteres.')
  if (location.length > 160) throw new Error('La ubicación es demasiado larga.')
  if (description.length > 2000) throw new Error('El detalle no puede superar los 2000 caracteres.')
  if (hours <= 0 || hours > 24) throw new Error('Las horas deben ser mayores a 0 y no superar 24.')
  if (cost < 0) throw new Error('El costo no puede ser negativo.')
  if (amount < 0) throw new Error('El monto no puede ser negativo.')

  return {
    work_date: workDate,
    location,
    description: description || null,
    hours: Math.round(hours * 100) / 100,
    cost: Math.round(cost * 100) / 100,
    amount: Math.round(amount * 100) / 100,
  }
}

const workEntrySelect = `
  id, company_id, work_date, location, description, hours, cost, amount,
  created_by, updated_by, created_at, updated_at,
  creator:profiles!work_entries_created_by_fkey(id, full_name, email)
`

export async function listWorkEntries({ companyId, dateFrom = '', dateTo = '', search = '' }) {
  const supabase = requireSupabase()
  let query = supabase
    .from('work_entries')
    .select(workEntrySelect)
    .eq('company_id', companyId)
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (dateFrom) query = query.gte('work_date', dateFrom)
  if (dateTo) query = query.lte('work_date', dateTo)

  const cleanedSearch = cleanSearch(search)
  if (cleanedSearch) {
    query = query.or(`location.ilike.%${cleanedSearch}%,description.ilike.%${cleanedSearch}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createWorkEntry({ companyId, values }) {
  const supabase = requireSupabase()
  const payload = { company_id: companyId, ...normalizeWorkEntry(values) }
  const { data, error } = await supabase.from('work_entries').insert(payload).select(workEntrySelect).single()
  if (error) throw error
  return data
}

export async function updateWorkEntry({ workEntryId, values }) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('work_entries')
    .update(normalizeWorkEntry(values))
    .eq('id', workEntryId)
    .select(workEntrySelect)
    .single()
  if (error) throw error
  return data
}

export async function deleteWorkEntry(workEntryId) {
  const supabase = requireSupabase()
  const { error } = await supabase.from('work_entries').delete().eq('id', workEntryId)
  if (error) throw error
}

export async function listWorkEntryActivity({ companyId, limit = 40 }) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('work_entry_activity')
    .select(`
      id, company_id, work_entry_id, action, entry_snapshot, created_at,
      actor:profiles!work_entry_activity_actor_id_fkey(id, full_name, email)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export function calculateWorkTotals(entries = []) {
  return entries.reduce((totals, entry) => {
    totals.count += 1
    totals.hours += Number(entry.hours) || 0
    totals.cost += Number(entry.cost) || 0
    totals.amount += Number(entry.amount) || 0
    totals.margin = totals.amount - totals.cost
    return totals
  }, { count: 0, hours: 0, cost: 0, amount: 0, margin: 0 })
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function excelCell(value, type = 'String') {
  return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`
}

export function buildWorkEntriesExcelXml(entries = [], companyName = 'Empresa') {
  const totals = calculateWorkTotals(entries)
  const rows = entries.map((entry) => [
    excelCell(entry.work_date),
    excelCell(entry.location),
    excelCell(entry.description || ''),
    excelCell(Number(entry.hours) || 0, 'Number'),
    excelCell(Number(entry.cost) || 0, 'Number'),
    excelCell(Number(entry.amount) || 0, 'Number'),
    excelCell((Number(entry.amount) || 0) - (Number(entry.cost) || 0), 'Number'),
    excelCell(entry.creator?.full_name || entry.creator?.email || ''),
  ].join('')).map((cells) => `<Row>${cells}</Row>`).join('')

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Trabajos diarios - ${escapeXml(companyName)}</Title>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
  <Style ss:ID="Money"><NumberFormat ss:Format="#,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="Trabajos">
  <Table>
   <Row ss:StyleID="Header">
    ${excelCell('Fecha')}${excelCell('Ubicación')}${excelCell('Detalle')}${excelCell('Horas')}${excelCell('Costo')}${excelCell('Monto')}${excelCell('Resultado')}${excelCell('Cargado por')}
   </Row>
   ${rows}
   <Row ss:StyleID="Header">
    ${excelCell('TOTALES')}${excelCell('')}${excelCell('')}${excelCell(totals.hours, 'Number')}${excelCell(totals.cost, 'Number')}${excelCell(totals.amount, 'Number')}${excelCell(totals.margin, 'Number')}${excelCell('')}
   </Row>
  </Table>
 </Worksheet>
</Workbook>`
}

export function downloadWorkEntriesExcel(entries, companyName = 'Empresa') {
  if (!entries?.length) throw new Error('No hay trabajos para exportar con los filtros actuales.')
  const xml = buildWorkEntriesExcelXml(entries, companyName)
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeCompany = companyName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'empresa'
  link.href = url
  link.download = `trabajos-${safeCompany}-${new Date().toISOString().slice(0, 10)}.xml`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
