import { requireSupabase } from '../lib/supabase'

export const COMPANY_SELECTION_KEY = 'integraflow.selected-company'

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

export function slugifyCompanyName(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
