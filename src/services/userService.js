import { requireSupabase } from '../lib/supabase'

export const COMPANY_ROLES = ['admin', 'responsible', 'member']

export const ROLE_LABELS = {
  admin: 'Administrador',
  responsible: 'Responsable',
  member: 'Miembro',
}

export async function listCompanyUsers(companyId) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('company_members')
    .select('user_id, role, is_active, joined_at, user:profiles(id, full_name, email)')
    .eq('company_id', companyId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return (data ?? []).filter((membership) => membership.user)
}

export async function updateCompanyUserAccess({ companyId, userId, role, isActive }) {
  if (!COMPANY_ROLES.includes(role)) throw new Error('Rol inválido.')

  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('company_members')
    .update({ role, is_active: Boolean(isActive) })
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .select('user_id, role, is_active, joined_at, user:profiles(id, full_name, email)')
    .single()

  if (error) {
    if (error.message?.includes('last_active_admin_required')) {
      throw new Error('Debe quedar al menos un administrador activo.')
    }
    throw error
  }

  return data
}
