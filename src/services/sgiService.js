import { requireSupabase } from '../lib/supabase'

export async function listSgiRequirements(companyId, norm = '') {
  const supabase = requireSupabase()
  let query = supabase
    .from('sgi_requirements')
    .select('id, norm, chapter, code, title, description')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('norm')
    .order('chapter')

  if (norm && norm !== 'General') query = query.eq('norm', norm)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function listNotifications() {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('sgi_notifications')
    .select('id, kind, title, message, read_at, created_at, document_id')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data ?? []
}

export async function markNotificationRead(id) {
  const supabase = requireSupabase()
  const { error } = await supabase
    .from('sgi_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
