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

export async function listNotifications(companyId) {
  const supabase = requireSupabase()
  let query = supabase
    .from('sgi_notifications')
    .select('id, company_id, kind, title, message, read_at, created_at, document_id')
    .order('created_at', { ascending: false })
    .limit(50)

  if (companyId) query = query.eq('company_id', companyId)

  const { data, error } = await query
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

export async function getSgiDashboardMetrics(companyId) {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('get_sgi_dashboard_metrics', {
    p_company_id: companyId,
  })

  if (error) {
    const missingRpc = error.code === '42883'
      || error.code === 'PGRST202'
      || error.message?.includes('get_sgi_dashboard_metrics')

    if (missingRpc) {
      console.warn('Dashboard SGI avanzado pendiente de migración.', error)
      return null
    }
    throw error
  }

  return data ?? null
}
