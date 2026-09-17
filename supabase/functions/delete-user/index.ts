import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured' }, 500)
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'not_authenticated' }, 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const token = authorization.slice('Bearer '.length)
  const { data: authData, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !authData.user) return json({ error: 'not_authenticated' }, 401)

  let payload: { userId?: string; companyId?: string }
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const userId = payload.userId?.trim()
  const companyId = payload.companyId?.trim()

  if (!userId) return json({ error: 'invalid_user' }, 400)
  if (userId === authData.user.id) return json({ error: 'cannot_delete_self' }, 400)

  const { data: targetUser, error: targetError } = await adminClient.auth.admin.getUserById(userId)
  if (targetError || !targetUser.user) return json({ error: 'user_not_found' }, 404)

  const [{ data: callerPlatformAdmin }, { data: targetPlatformAdmin }] = await Promise.all([
    adminClient.from('platform_admins').select('user_id').eq('user_id', authData.user.id).maybeSingle(),
    adminClient.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
  ])

  if (!callerPlatformAdmin) {
    if (!companyId) return json({ error: 'company_required' }, 400)

    const [{ data: callerMembership }, { data: targetMembership }, { count: targetCompanyCount }] = await Promise.all([
      adminClient
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('user_id', authData.user.id)
        .eq('role', 'admin')
        .eq('is_active', true)
        .maybeSingle(),
      adminClient
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .maybeSingle(),
      adminClient
        .from('company_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

    if (!callerMembership || !targetMembership) return json({ error: 'admin_required' }, 403)
    if (targetPlatformAdmin) return json({ error: 'platform_admin_required' }, 403)
    if ((targetCompanyCount ?? 0) > 1) {
      return json({ error: 'platform_admin_required_for_multi_company_user' }, 403)
    }
  }

  if (targetPlatformAdmin) {
    const { count: platformAdminCount } = await adminClient
      .from('platform_admins')
      .select('*', { count: 'exact', head: true })

    if ((platformAdminCount ?? 0) <= 1) {
      return json({ error: 'last_platform_admin_required' }, 409)
    }
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId, false)
  if (deleteError) {
    const message = deleteError.message || 'delete_failed'
    const status = /not found/i.test(message) ? 404 : 409
    return json({ error: message }, status)
  }

  return json({
    ok: true,
    deletedUserId: userId,
    deletedEmail: targetUser.user.email ?? null,
  })
})
