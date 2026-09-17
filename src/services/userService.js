import { FunctionsHttpError } from '@supabase/supabase-js'
import { APP_URL } from '../lib/constants'
import { requireSupabase } from '../lib/supabase'

export const COMPANY_ROLES = ['admin', 'responsible', 'member']

export const ROLE_LABELS = {
  admin: 'Administrador',
  responsible: 'Responsable',
  member: 'Miembro',
}

const membershipSelect = `
  company_id,
  user_id,
  role,
  is_active,
  joined_at,
  company:companies(id, name, slug, is_active),
  user:profiles(id, full_name, email, created_at)
`

async function readFunctionError(error, data) {
  let payload = data

  if (!payload && error instanceof FunctionsHttpError && error.context) {
    try {
      payload = await error.context.clone().json()
    } catch {
      try {
        const text = await error.context.clone().text()
        if (text) payload = { error: text }
      } catch {
        // Keep the SDK error as a last-resort fallback.
      }
    }
  }

  return String(payload?.error || payload?.message || error?.message || '')
}

async function getInviteErrorMessage(error, data) {
  const message = await readFunctionError(error, data)

  if (/already|registered|exists|user.*exist/i.test(message)) {
    return 'Ese correo ya tiene una cuenta o una invitación creada. Eliminá la cuenta anterior si corresponde y volvé a invitarlo.'
  }
  if (message === 'invalid_invitation') return 'Los datos de la invitación son inválidos. Revisá correo, empresa y rol.'
  if (message === 'company_not_found') return 'La empresa seleccionada no existe o está desactivada.'
  if (message === 'admin_required') return 'Tu cuenta no tiene permisos para invitar usuarios a esta empresa.'
  if (message === 'not_authenticated') return 'Tu sesión venció. Volvé a iniciar sesión e intentá nuevamente.'
  if (message === 'server_not_configured') return 'La función de invitaciones no tiene configuradas las credenciales requeridas.'
  if (/rate limit/i.test(message)) return 'Se limitó temporalmente el envío de correos. Esperá un momento antes de volver a intentar.'

  return message || 'No se pudo enviar la invitación.'
}

async function getDeleteErrorMessage(error, data) {
  const message = await readFunctionError(error, data)

  if (message === 'cannot_delete_self') return 'No podés eliminar tu propia cuenta desde esta pantalla.'
  if (message === 'user_not_found') return 'La cuenta ya no existe o fue eliminada previamente.'
  if (message === 'admin_required') return 'Tu cuenta no tiene permisos para eliminar a este usuario.'
  if (message === 'platform_admin_required') return 'Solo un administrador global puede eliminar esta cuenta.'
  if (message === 'platform_admin_required_for_multi_company_user') {
    return 'Este usuario pertenece a más de una empresa. La eliminación completa debe hacerla un administrador global.'
  }
  if (message === 'last_platform_admin_required') return 'No se puede eliminar al último administrador global de la plataforma.'
  if (message === 'not_authenticated') return 'Tu sesión venció. Volvé a iniciar sesión e intentá nuevamente.'
  if (message === 'server_not_configured') return 'La función de eliminación no tiene configuradas las credenciales requeridas.'
  if (/last_active_admin_required/i.test(message)) return 'Debe quedar al menos un administrador activo en la empresa.'

  return message || 'No se pudo eliminar la cuenta.'
}

export async function listCompanyUsers(companyId) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('company_members')
    .select(membershipSelect)
    .eq('company_id', companyId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return (data ?? []).filter((membership) => membership.user)
}

export async function listAllCompanyUsers() {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('company_members')
    .select(membershipSelect)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return (data ?? []).filter((membership) => membership.user && membership.company)
}

export async function updateCompanyUserAccess({ companyId, userId, role, isActive }) {
  if (!COMPANY_ROLES.includes(role)) throw new Error('Rol inválido.')

  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('company_members')
    .update({ role, is_active: Boolean(isActive) })
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .select(membershipSelect)
    .single()

  if (error) {
    if (error.message?.includes('last_active_admin_required')) {
      throw new Error('Debe quedar al menos un administrador activo.')
    }
    throw error
  }

  return data
}

export async function inviteCompanyUser({ companyId, email, fullName, role }) {
  if (!COMPANY_ROLES.includes(role)) throw new Error('Rol inválido.')

  const supabase = requireSupabase()
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      companyId,
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      role,
      redirectTo: `${APP_URL}/set-password`,
    },
  })

  if (error) throw new Error(await getInviteErrorMessage(error, data))
  return data
}

export async function deleteUserCompletely({ userId, companyId }) {
  const supabase = requireSupabase()
  const { data, error } = await supabase.functions.invoke('delete-user', {
    body: { userId, companyId },
  })

  if (error) throw new Error(await getDeleteErrorMessage(error, data))
  return data
}
