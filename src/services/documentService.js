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
  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new Error('El archivo supera el límite de 25 MB.')
  }
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    throw new Error('Formato no admitido. Usá PDF, Word, Excel o una imagen JPG/PNG/WEBP.')
  }
}

const documentSelect = `
  id,
  company_id,
  module_id,
  responsible_id,
  created_by,
  title,
  description,
  document_type,
  norm,
  status,
  file_name,
  file_path,
  mime_type,
  file_size,
  approved_at,
  created_at,
  updated_at,
  module:modules(id, name, code),
  responsible:profiles!documents_responsible_id_fkey(id, full_name, email),
  creator:profiles!documents_created_by_fkey(id, full_name, email)
`

export async function listDocuments({ companyId, filters = {} }) {
  const supabase = requireSupabase()
  let query = supabase
    .from('documents')
    .select(documentSelect)
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })

  const search = cleanSearchTerm(filters.search)
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,file_name.ilike.%${search}%`)
  }
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.moduleId) query = query.eq('module_id', filters.moduleId)
  if (filters.norm) query = query.eq('norm', filters.norm)
  if (filters.documentType) query = query.eq('document_type', filters.documentType)
  if (filters.dateFrom) {
    query = query.gte('created_at', new Date(`${filters.dateFrom}T00:00:00`).toISOString())
  }
  if (filters.dateTo) {
    query = query.lte('created_at', new Date(`${filters.dateTo}T23:59:59.999`).toISOString())
  }

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
    .order('joined_at')

  if (error) throw error
  return (data ?? []).filter((member) => member.user)
}

export async function createDocument({ companyId, userId, values, file }) {
  validateDocumentFile(file)
  const supabase = requireSupabase()
  const documentId = crypto.randomUUID()
  const safeName = sanitizeFilename(file.name)
  const filePath = `${companyId}/${documentId}/${Date.now()}-${safeName}`

  const payload = {
    id: documentId,
    company_id: companyId,
    module_id: values.moduleId || null,
    title: values.title.trim(),
    description: values.description.trim() || null,
    document_type: values.documentType,
    norm: values.norm || null,
    status: 'draft',
    responsible_id: values.responsibleId || null,
    file_name: file.name,
    file_path: filePath,
    mime_type: file.type,
    file_size: file.size,
    created_by: userId,
  }

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .insert(payload)
    .select('id')
    .single()

  if (documentError) throw documentError

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    await supabase.from('documents').delete().eq('id', documentId)
    throw uploadError
  }

  return document
}

export async function openDocumentFile(filePath) {
  const supabase = requireSupabase()
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(filePath, 60)

  if (error) throw error
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

export async function getDocumentDetail(documentId) {
  const supabase = requireSupabase()
  const [documentResult, commentsResult, activityResult] = await Promise.all([
    supabase.from('documents').select(documentSelect).eq('id', documentId).single(),
    supabase
      .from('document_comments')
      .select('id, comment, created_at, author:profiles(id, full_name, email)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true }),
    supabase
      .from('document_activity')
      .select('id, action, from_status, to_status, details, created_at, actor:profiles(id, full_name, email)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false }),
  ])

  if (documentResult.error) throw documentResult.error
  if (commentsResult.error) throw commentsResult.error
  if (activityResult.error) throw activityResult.error

  return {
    document: documentResult.data,
    comments: commentsResult.data ?? [],
    activity: activityResult.data ?? [],
  }
}

export async function updateDocumentStatus(documentId, status) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('documents')
    .update({ status })
    .eq('id', documentId)
    .select('id, status, approved_at, updated_at')
    .single()

  if (error) throw error
  return data
}

export async function updateDocumentMetadata(documentId, values) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('documents')
    .update({
      title: values.title.trim(),
      description: values.description.trim() || null,
      document_type: values.documentType,
      norm: values.norm || null,
      module_id: values.moduleId || null,
      responsible_id: values.responsibleId || null,
    })
    .eq('id', documentId)
    .select('id, updated_at')
    .single()

  if (error) throw error
  return data
}

export async function addDocumentComment({ documentId, authorId, comment }) {
  const supabase = requireSupabase()
  const cleanedComment = comment.trim()
  if (!cleanedComment) throw new Error('Escribí una observación antes de guardar.')

  const { data, error } = await supabase
    .from('document_comments')
    .insert({ document_id: documentId, author_id: authorId, comment: cleanedComment })
    .select('id')
    .single()

  if (error) throw error
  return data
}
