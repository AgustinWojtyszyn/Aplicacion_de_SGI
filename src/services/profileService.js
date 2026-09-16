import { requireSupabase } from '../lib/supabase'

export async function updateOwnProfile({ userId, fullName }) {
  const cleanName = fullName.trim()
  if (!userId) throw new Error('No se encontró el usuario actual.')
  if (cleanName.length < 2) throw new Error('Ingresá un nombre válido.')
  if (cleanName.length > 120) throw new Error('El nombre es demasiado largo.')

  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: cleanName })
    .eq('id', userId)
    .select('id, full_name, email, created_at, updated_at')
    .single()

  if (error) throw error
  return data
}

export async function changePasswordWithCurrent({ email, currentPassword, newPassword }) {
  const cleanEmail = email?.trim().toLowerCase()
  if (!cleanEmail) throw new Error('No se encontró el correo de la cuenta.')
  if (!currentPassword) throw new Error('Ingresá tu contraseña actual.')
  if (newPassword.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.')
  if (currentPassword === newPassword) throw new Error('La nueva contraseña debe ser diferente de la actual.')

  const supabase = requireSupabase()
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: currentPassword,
  })

  if (verifyError) throw new Error('La contraseña actual no es correcta.')

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
