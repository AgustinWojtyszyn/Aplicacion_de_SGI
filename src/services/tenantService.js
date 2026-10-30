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

export async function getLoginCompany(slug) {
  const supabase = requireSupabase()
  const cleanSlug = decodeURIComponent(String(slug || '')).trim().toLowerCase()
  if (!cleanSlug) return null

  const { data, error } = await supabase.rpc('get_login_company', {
    p_slug: cleanSlug,
  })

  if (!error) {
    return Array.isArray(data) ? data[0] ?? null : data ?? null
  }

  // Backward-compatible fallback while the new RPC reaches production.
  if (/get_login_company|schema cache|function/i.test(error.message || '')) {
    const companies = await listLoginCompanies()
    return companies.find((item) => item.slug?.toLowerCase() === cleanSlug) ?? null
  }

  throw error
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

  // No iniciar nunca un borrado sin verificar también el contenido oculto
  // (carpetas, trabajos y registros de trabajos ya eliminados).
  const tables = ['documents', 'document_folders', 'work_entries', 'work_entry_activity']
  const results = await Promise.all(tables.map((table) => (
    supabase.from(table).select('id', { count: 'exact', head: true }).eq('company_id', companyId)
  )))

  if (results.some((result) => result.error)) {
    throw new Error('No se pudo comprobar si la empresa tiene información. No se eliminó nada.')
  }

  if (results[0].count > 0) {
    throw new Error('Esta empresa tiene documentos. Eliminá primero su documentación o archivala para ocultarla del acceso.')
  }
  if (results[1].count > 0) {
    throw new Error('Esta empresa todavía tiene carpetas. Eliminá primero las carpetas vacías o mantenela archivada.')
  }
  if (results[2].count > 0 || results[3].count > 0) {
    throw new Error('Esta empresa tiene trabajos o historial operativo. Para conservar esos registros, solo se puede archivar.')
  }

  const { error } = await supabase.rpc('delete_company_workspace', {
    p_company_id: companyId,
  })

  if (error) {
    const messages = {
      system_company_cannot_be_deleted: 'El espacio principal de gestiQa no se puede eliminar.',
      company_must_be_archived_before_delete: 'Primero archivá la empresa y después podrás eliminarla.',
      company_has_documents: 'La empresa tiene documentos. No se eliminó nada; primero quitá su documentación o archivala.',
      company_has_folders: 'La empresa tiene carpetas. No se eliminó nada.',
      company_has_work_history: 'La empresa tiene trabajos o historial operativo. No se eliminó nada; podés archivarla.',
      not_authorized: 'Solo una persona con permisos de administración global puede eliminar empresas.',
      company_not_found: 'La empresa ya no existe. Actualizá el listado.',
    }
    const knownCode = Object.keys(messages).find((code) => error.message?.includes(code))
    if (knownCode) throw new Error(messages[knownCode])
    throw error
  }
}

// También contempla los identificadores de empresas archivadas.
export function findCompanyBySlug(companies, slug) {
  const normalized = String(slug ?? '').trim().toLowerCase()
  if (!normalized) return null
  return (companies ?? []).find((company) => company.slug?.toLowerCase() === normalized) ?? null
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
