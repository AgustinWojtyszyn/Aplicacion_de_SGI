import { requireSupabase } from '../lib/supabase'

const MANAGER_ROLES = ['admin', 'responsible']
export const canManageInspections = (role) => MANAGER_ROLES.includes(role)
export const inspectionCode = (number) => `BPM-${String(number || 0).padStart(6, '0')}`

function throwIfError(response) {
  if (response.error) throw response.error
  return response.data ?? []
}
export function normalizeSiteCode(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().trim().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)
}

export async function listQualitySites(companyId) {
  return throwIfError(await requireSupabase().from('quality_sites')
    .select('id, company_id, name, code, active, created_at')
    .eq('company_id', companyId).order('name'))
}
export async function createQualitySite(companyId, name, code) {
  const cleanName = String(name || '').trim()
  const cleanCode = normalizeSiteCode(code || cleanName)
  if (cleanName.length < 2 || cleanCode.length < 2) throw new Error('Completá nombre y código de establecimiento.')
  const data = throwIfError(await requireSupabase().from('quality_sites')
    .insert({ company_id: companyId, name: cleanName, code: cleanCode })
    .select('id, name, code').single())
  return data
}

export async function listQualityInspections(companyId, siteId) {
  let query = requireSupabase().from('quality_inspections')
    .select('id, inspection_number, site_id, inspector_name, inspection_date, status, created_at, closed_at, site:quality_sites!quality_inspections_company_id_site_id_fkey(name, code)')
    .eq('company_id', companyId)
    .order('inspection_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(150)
  if (siteId) query = query.eq('site_id', siteId)
  return throwIfError(await query)
}
export async function listQualityTemplate(revision = 1) {
  return throwIfError(await requireSupabase().from('quality_checklist_items')
    .select('revision, item_number, section, question')
    .eq('revision', revision).order('item_number'))
}
export async function getQualityInspection(companyId, inspectionId) {
  const data = throwIfError(await requireSupabase().from('quality_inspections')
    .select('id, inspection_number, company_id, site_id, checklist_revision, inspection_date, previous_inspection_date, start_time, end_time, inspector_name, notes, status, created_at, closed_at')
    .eq('company_id', companyId).eq('id', inspectionId).single())
  return data
}
export async function listQualityAnswers(companyId, inspectionId) {
  return throwIfError(await requireSupabase().from('quality_inspection_answers')
    .select('id, item_number, result, comments, corrective_action, followup_status, due_date, followup_category, evidence_before, evidence_after, updated_at')
    .eq('company_id', companyId).eq('inspection_id', inspectionId).order('item_number'))
}
export async function createQualityInspection({ companyId, siteId, inspectorName, inspectionDate }) {
  const existing = await listQualityInspections(companyId, siteId)
  const previousDate = existing.find((entry) => entry.status === 'closed' && entry.inspection_date <= inspectionDate)?.inspection_date ?? null
  return throwIfError(await requireSupabase().from('quality_inspections')
    .insert({
      company_id: companyId, site_id: siteId,
      inspector_name: inspectorName.trim(), inspection_date: inspectionDate,
      previous_inspection_date: previousDate,
    })
    .select('id, inspection_number').single())
}
export async function saveQualityAnswer({ companyId, inspectionId, itemNumber, revision = 1, result, comments, correctiveAction, followupStatus, dueDate, evidenceBefore, evidenceAfter, followupCategory, followupOnly = false }) {
  const needsFollowup = result === 'non_complies' || result === 'partial'
  const state = needsFollowup ? (followupStatus === 'not_required' ? 'open' : followupStatus || 'open') : 'not_required'
  // Las inspecciones cerradas conservan el hallazgo original. Solo puede actualizarse
  // el seguimiento; un UPSERT ejecutaría el trigger INSERT y bloquearía la actualización.
  if (followupOnly) {
    if (!needsFollowup) throw new Error('Un punto conforme o no aplicable no requiere seguimiento.')
    return throwIfError(await requireSupabase().from('quality_inspection_answers')
      .update({
        corrective_action: correctiveAction?.trim() || null,
        followup_status: state, due_date: dueDate || null,
        followup_category: followupCategory || null,
        evidence_after: evidenceAfter || null,
      })
      .eq('company_id', companyId).eq('inspection_id', inspectionId).eq('item_number', itemNumber)
      .select('id, item_number').single())
  }
  return throwIfError(await requireSupabase().from('quality_inspection_answers').upsert({
    company_id: companyId, inspection_id: inspectionId, checklist_revision: revision, item_number: itemNumber,
    result, comments: comments?.trim() || null, corrective_action: correctiveAction?.trim() || null,
    followup_status: state, due_date: needsFollowup && dueDate ? dueDate : null,
    followup_category: needsFollowup ? (followupCategory || null) : null,
    evidence_before: evidenceBefore || null, evidence_after: evidenceAfter || null,
  }, { onConflict: 'inspection_id,item_number' }).select('id, item_number').single())
}
export async function closeQualityInspection(companyId, inspectionId) {
  return throwIfError(await requireSupabase().from('quality_inspections')
    .update({ status: 'closed' }).eq('company_id', companyId).eq('id', inspectionId)
    .select('id, closed_at').single())
}
export async function listQualityActivity(companyId, inspectionId) {
  return throwIfError(await requireSupabase().from('quality_inspection_activity')
    .select('id, actor_id, action, created_at')
    .eq('company_id', companyId).eq('inspection_id', inspectionId)
    .order('created_at', { ascending: false }).limit(100))
}
export async function uploadQualityEvidence(companyId, inspectionId, itemNumber, stage, file) {
  if (!['before', 'after'].includes(stage)) throw new Error('Tipo de evidencia inválido.')
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Solo se admiten imágenes JPG, PNG o WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen no puede superar 5 MB.')
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
  const uuid = crypto.randomUUID()
  const path = `${companyId}/${inspectionId}/${itemNumber}/${stage}/${uuid}.${ext}`
  const { error } = await requireSupabase().storage.from('quality-evidence').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return path
}
export async function getQualityEvidenceUrl(path) {
  if (!path) return null
  const { data, error } = await requireSupabase().storage.from('quality-evidence').createSignedUrl(path, 120)
  if (error) throw error
  return data.signedUrl
}
export function qualityScore(answers) {
  const inspected = answers.filter((a) => a.result && a.result !== 'na')
  const complies = inspected.filter((a) => a.result === 'complies').length
  const partial = inspected.filter((a) => a.result === 'partial').length
  const findings = answers.filter((a) => a.result === 'non_complies' || a.result === 'partial')
  const pending = findings.filter((a) => a.followup_status !== 'closed')
  return { inspected: inspected.length, complies, partial, findings: findings.length, pending: pending.length,
    percentage: inspected.length ? Math.round(100 * complies / inspected.length) : 0 }
}
