import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  DOCUMENT_BUCKET,
  MAX_DOCUMENT_SIZE,
} from '../lib/constants'
import { requireSupabase } from '../lib/supabase'

function cleanSearchTerm(value = '') {
  return value.replace(/[,%()]/g, ' ').trim()
}

function sanitizeFilename(name = 'documento') {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || 'documento'
}

export function validateDocumentFile(file) {
  if (!file) throw new Error('Seleccioná un archivo para continuar.')
  if (file.size > MAX_DOCUMENT_SIZE) throw new Error('El archivo supera el límite de 25 MB.')
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    throw new Error('Formato no admitido. Usá PDF, Word, Excel o una imagen JPG/PNG/WEBP.')
  }
}

const documentSelect = `
  id, company_id, module_id, requirement_id, responsible_id, reviewer_id, approver_id, created_by,
  title, description, document_type, norm, status, file_name, file_path, mime_type, file_size,
  approved_at, review_due_at, current_version, submitted_for_review_at, reviewed_at, created_at, updated_at,
  module:modules(id, name, code),
  requirement:sgi_requirements(id, norm, chapter, code, title),
  responsible:profiles!documents_responsible_id_fkey(id, full_name, email),
  reviewer:profiles!documents_reviewer_id_fkey(id, full_name, email),
  approver:profiles!documents_approver_id_fkey(id, full_name, email),
  creator:profiles!documents_created_by_fkey(id, full_name, email)
`

export async function listDocuments({ companyId, filters = {} }) {
  const supabase = requireSupabase()
  let query = supabase.from('documents').select(documentSelect).eq('company_id', companyId).order('updated_at', { ascending: false })
  const search = cleanSearchTerm(filters.search)
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,file_name.ilike.%${search}%`)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.moduleId) query = query.eq('module_id', filters.moduleId)
  if (filters.norm) query = query.eq('norm', filters.norm)
  if (filters.documentType) query = query.eq('document_type', filters.documentType)
  if (filters.dateFrom) query = query.gte('created_at', new Date(`${filters.dateFrom}T00:00:00`).toISOString())
  if (filters.dateTo) query = query.lte('created_at', new Date(`${filters.dateTo}T23:59:59.999`).toISOString())
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function listCompanyMembers(companyId) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('company_members')
    .select('role, joined_at, user:profiles(id, full_name, email)')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('joined_at')
  if (error) throw error
  return (data ?? []).filter((member) => member.user)
}

export async function createDocument({ companyId, userId, values, file }) {
  validateDocumentFile(file)
  const supabase = requireSupabase()
  const documentId = crypto.randomUUID()
  const filePath = `${companyId}/${documentId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const payload = {
    id: documentId,
    company_id: companyId,
    module_id: values.moduleId || null,
    requirement_id: values.requirementId || null,
    title: values.title.trim(),
    description: values.description.trim() || null,
    document_type: values.documentType,
    norm: values.norm || null,
    status: 'draft',
    responsible_id: values.responsibleId || null,
    review_due_at: values.reviewDueAt ? new Date(`${values.reviewDueAt}T23:59:59`).toISOString() : null,
    file_name: file.name,
    file_path: filePath,
    mime_type: file.type,
    file_size: file.size,
    created_by: userId,
  }
  const { data: document, error: documentError } = await supabase.from('documents').insert(payload).select('id').single()
  if (documentError) throw documentError
  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(filePath, file, { cacheControl: '3600', contentType: file.type, upsert: false })
  if (uploadError) {
    await supabase.from('documents').delete().eq('id', documentId)
    throw uploadError
  }
  return document
}

export async function deleteDocument({ documentId, filePath }) {
  const supabase = requireSupabase()
  const { data: versions } = await supabase.from('document_versions').select('file_path').eq('document_id', documentId)
  const { error } = await supabase.from('documents').delete().eq('id', documentId)
  if (error) throw error
  const paths = [...new Set([filePath, ...(versions ?? []).map((item) => item.file_path)].filter(Boolean))]
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(DOCUMENT_BUCKET).remove(paths)
    if (storageError) console.error('Document deleted but storage cleanup failed', storageError)
  }
}

export async function openDocumentFile(filePath) {
  const supabase = requireSupabase()
  const previewWindow = window.open('', '_blank')
  try {
    const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(filePath, 60)
    if (error) throw error
    if (previewWindow) {
      previewWindow.opener = null
      previewWindow.location.href = data.signedUrl
    } else window.location.assign(data.signedUrl)
  } catch (error) {
    previewWindow?.close()
    throw error
  }
}

export async function getDocumentDetail(documentId) {
  const supabase = requireSupabase()
  const [documentResult, commentsResult, activityResult, versionsResult] = await Promise.all([
    supabase.from('documents').select(documentSelect).eq('id', documentId).single(),
    supabase.from('document_comments').select('id, comment, created_at, author:profiles(id, full_name, email)').eq('document_id', documentId).order('created_at'),
    supabase.from('document_activity').select('id, action, from_status, to_status, details, created_at, actor:profiles(id, full_name, email)').eq('document_id', documentId).order('created_at', { ascending: false }),
    supabase.from('document_versions').select('id, version_number, file_name, file_path, file_size, comment, created_at, creator:profiles!document_versions_created_by_fkey(id, full_name, email)').eq('document_id', documentId).order('version_number', { ascending: false }),
  ])
  if (documentResult.error) throw documentResult.error
  if (commentsResult.error) throw commentsResult.error
  if (activityResult.error) throw activityResult.error
  if (versionsResult.error) throw versionsResult.error
  return { document: documentResult.data, comments: commentsResult.data ?? [], activity: activityResult.data ?? [], versions: versionsResult.data ?? [] }
}

export async function updateDocumentMetadata(documentId, values) {
  const supabase = requireSupabase()
  const { data, error } = await supabase.from('documents').update({
    title: values.title.trim(), description: values.description.trim() || null,
    document_type: values.documentType, norm: values.norm || null,
    module_id: values.moduleId || null, requirement_id: values.requirementId || null,
    responsible_id: values.responsibleId || null,
    review_due_at: values.reviewDueAt ? new Date(`${values.reviewDueAt}T23:59:59`).toISOString() : null,
  }).eq('id', documentId).select('id, updated_at').single()
  if (error) throw error
  return data
}

export async function addDocumentComment({ documentId, authorId, comment }) {
  const supabase = requireSupabase()
  const cleaned = comment.trim()
  if (!cleaned) throw new Error('Escribí una observación antes de guardar.')
  const { data, error } = await supabase.from('document_comments').insert({ document_id: documentId, author_id: authorId, comment: cleaned }).select('id').single()
  if (error) throw error
  return data
}

export async function createDocumentVersion({ companyId, documentId, file, comment }) {
  validateDocumentFile(file)
  const supabase = requireSupabase()
  const filePath = `${companyId}/${documentId}/versions/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(filePath, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError
  const { data, error } = await supabase.rpc('create_document_version', {
    p_document_id: documentId, p_file_name: file.name, p_file_path: filePath,
    p_mime_type: file.type, p_file_size: file.size, p_comment: comment?.trim() || null,
  })
  if (error) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([filePath])
    throw error
  }
  return data
}

async function workflowRpc(name, args) {
  const supabase = requireSupabase()
  const { error } = await supabase.rpc(name, args)
  if (error) throw error
}

export function submitDocumentForReview({ documentId, reviewerId, approverId, reviewDueAt, comment }) {
  return workflowRpc('submit_document_for_review', {
    p_document_id: documentId, p_reviewer_id: reviewerId, p_approver_id: approverId,
    p_review_due_at: reviewDueAt ? new Date(`${reviewDueAt}T23:59:59`).toISOString() : null,
    p_comment: comment?.trim() || null,
  })
}

export function reviewDocument(documentId, comment) {
  return workflowRpc('review_document', { p_document_id: documentId, p_comment: comment?.trim() || null })
}

export function rejectDocument(documentId, comment) {
  return workflowRpc('reject_document', { p_document_id: documentId, p_comment: comment?.trim() || '' })
}

export function approveDocument(documentId, comment) {
  return workflowRpc('approve_document', { p_document_id: documentId, p_comment: comment?.trim() || null })
}
