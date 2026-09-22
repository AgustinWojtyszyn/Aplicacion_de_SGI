import { DOCUMENT_BUCKET } from '../lib/constants'
import { requireSupabase } from '../lib/supabase'

export const COMPANY_SELECTION_KEY = 'ep-consultora.selected-company'

export function rememberSelectedCompany(company) {
  if (!company?.slug) return
  window.localStorage.setItem(COMPANY_SELECTION_KEY, JSON.stringify({
    id: company.id,
    name: company.name,
    slug: company.slug,
  }))
}

export function readSelectedCompany() {
  try {
    const raw = window.localStorage.getItem(COMPANY_SELECTION_KEY)
    if (!raw) return null
    const company = JSON.parse(raw)
    return company?.slug ? company : null
  } catch {
    return null
  }
}

export async function listLoginCompanies() {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('list_login_companies')
  if (error) throw error
  return data ?? []
}

export async function createCompanyWorkspace({ name, slug }) {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('create_company_workspace', {
    p_name: name.trim(),
    p_slug: slug.trim().toLowerCase(),
  })

  if (error) {
    if (error.message?.includes('company_slug_already_exists')) {
      throw new Error('Ya existe una empresa con ese identificador.')
    }
    if (error.message?.includes('invalid_company_slug')) {
      throw new Error('El identificador solo puede usar minúsculas, números y guiones.')
    }
    throw error
  }

  return data
}


export async function listManagedCompanies() {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('list_managed_companies')
  if (error) throw error
  return data ?? []
}

export async function updateCompanyWorkspace({ companyId, name, slug }) {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('update_company_workspace', {
    p_company_id: companyId,
    p_name: name.trim(),
    p_slug: slug.trim().toLowerCase(),
  })

  if (error) {
    if (error.message?.includes('company_slug_already_exists')) {
      throw new Error('Ya existe una empresa con ese identificador.')
    }
    if (error.message?.includes('invalid_company_slug')) {
      throw new Error('El identificador solo puede usar minúsculas, números y guiones.')
    }
    if (error.message?.includes('system_company_slug_locked')) {
      throw new Error('El identificador principal de gestiQa no puede modificarse.')
    }
    throw error
  }

  return Array.isArray(data) ? data[0] : data
}

export async function setCompanyActive({ companyId, isActive }) {
  const supabase = requireSupabase()
  const { error } = await supabase.rpc('set_company_active', {
    p_company_id: companyId,
    p_is_active: Boolean(isActive),
  })

  if (error) {
    if (error.message?.includes('system_company_cannot_be_archived')) {
      throw new Error('El espacio principal de gestiQa no se puede archivar.')
    }
    throw error
  }
}

export async function deleteCompanyWorkspace(companyId) {
  const supabase = requireSupabase()

  const [documentsResult, versionsResult] = await Promise.all([
    supabase
      .from('documents')
      .select('file_path')
      .eq('company_id', companyId),
    supabase
      .from('document_versions')
      .select('file_path, document:documents!inner(company_id)')
      .eq('document.company_id', companyId),
  ])

  if (documentsResult.error) throw documentsResult.error
  if (versionsResult.error) throw versionsResult.error

  const storagePaths = [...new Set([
    ...(documentsResult.data ?? []).map((item) => item.file_path),
    ...(versionsResult.data ?? []).map((item) => item.file_path),
  ].filter(Boolean))]

  const { error } = await supabase.rpc('delete_company_workspace', {
    p_company_id: companyId,
  })

  if (error) {
    if (error.message?.includes('system_company_cannot_be_deleted')) {
      throw new Error('El espacio principal de gestiQa no se puede eliminar.')
    }
    if (error.message?.includes('company_must_be_archived_before_delete')) {
      throw new Error('Primero archivá la empresa y después podés eliminarla definitivamente.')
    }
    throw error
  }

  let cleanupFailed = false
  for (let index = 0; index < storagePaths.length; index += 100) {
    const batch = storagePaths.slice(index, index + 100)
    const { error: storageError } = await supabase.storage.from(DOCUMENT_BUCKET).remove(batch)
    if (storageError) {
      console.error('Company deleted but storage cleanup failed', storageError)
      cleanupFailed = true
    }
  }

  return { cleanupFailed }
}

export function slugifyCompanyName(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
