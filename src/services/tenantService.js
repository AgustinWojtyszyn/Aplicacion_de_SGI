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

export async function getLoginCompany(slug) {
  const supabase = requireSupabase()
  const cleanSlug = decodeURIComponent(String(slug || '')).trim().toLowerCase()
  if (!cleanSlug) return null

  const { data, error } = await supabase.rpc('get_login_company', {
    p_slug: cleanSlug,
  })

  if (error) throw error
  return Array.isArray(data) ? data[0] ?? null : data ?? null
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

const COMPANY_DELETE_FUNCTION = 'delete-company'

async function invokeCompanyDeletion(body) {
  const supabase = requireSupabase()
  const { data, error } = await supabase.functions.invoke(COMPANY_DELETE_FUNCTION, { body })

  if (error || data?.error) {
    let code = data?.error || ''
    if (error?.context?.clone) {
      try {
        const payload = await error.context.clone().json()
        code = payload?.error || code
      } catch {
        // Fallos de gateway pueden devolver texto en vez de JSON.
      }
    }
    const messages = {
      not_authenticated: 'La sesión venció. Volvé a ingresar.',
      not_authorized: 'Solo un administrador global puede eliminar empresas.',
      invalid_company: 'La empresa indicada no es válida.',
      company_not_found: 'La empresa ya no existe. Actualizá el listado.',
      company_name_mismatch: 'El nombre de la empresa cambió. Actualizá el listado e intentá de nuevo.',
      system_company_cannot_be_deleted: 'El espacio principal de gestiQa está protegido.',
      purge_job_not_found: 'No se encontró la limpieza pendiente.',
      authorization_check_failed: 'No se pudieron comprobar tus permisos. Probá nuevamente.',
      server_not_configured: 'Falta configurar la función de eliminación de empresas en Supabase.',
    }
    const message = messages[code] || (error?.context?.status === 404
      ? 'Falta desplegar la función delete-company en Supabase.'
      : 'No se pudo completar la operación. Revisá la conexión y volvé a intentar.')
    throw new Error(message)
  }
  return data
}

export async function deleteCompanyWorkspace(companyId, companyName) {
  const result = await invokeCompanyDeletion({ action: 'delete', companyId, companyName })
  if (!result?.jobId || typeof result.completed !== 'boolean') {
    throw new Error('Supabase devolvió una respuesta incompleta. Consultá las limpiezas pendientes antes de intentar de nuevo.')
  }
  return result
}

export async function listPendingCompanyDeletions() {
  const result = await invokeCompanyDeletion({ action: 'list' })
  return result?.jobs ?? []
}

export async function retryCompanyDeletion(jobId) {
  const result = await invokeCompanyDeletion({ action: 'retry', jobId })
  if (!result?.jobId || typeof result.completed !== 'boolean') {
    throw new Error('No se pudo verificar el resultado de la limpieza.')
  }
  return result
}

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
