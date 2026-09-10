import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const validRoles = new Set(['admin', 'responsible', 'member'])

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

  let payload: {
    companyId?: string
    email?: string
    fullName?: string
    role?: string
    redirectTo?: string
  }

  try {
    payload = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const companyId = payload.companyId?.trim()
  const email = payload.email?.trim().toLowerCase()
  const fullName = payload.fullName?.trim() || ''
  const role = payload.role?.trim() || 'member'
  const redirectTo = payload.redirectTo?.trim()

  if (!companyId || !email || !email.includes('@') || !validRoles.has(role)) {
    return json({ error: 'invalid_invitation' }, 400)
  }

  // Administrators are global in IntegraFlow: an active admin membership in
  // any company authorizes administration of all company workspaces.
  const { data: adminMemberships, error: membershipError } = await adminClient
    .from('company_members')
    .select('company_id')
    .eq('user_id', authData.user.id)
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)

  if (membershipError) return json({ error: 'membership_check_failed' }, 500)
  if (!adminMemberships?.length) return json({ error: 'admin_required' }, 403)

  const { data: company, error: companyError } = await adminClient
    .from('companies')
    .select('id, name, slug, is_active')
    .eq('id', companyId)
    .eq('is_active', true)
    .maybeSingle()

  if (companyError || !company) return json({ error: 'company_not_found' }, 404)

  const inviteOptions: { data: Record<string, string>; redirectTo?: string } = {
    data: {
      full_name: fullName,
      company_name: company.name,
      company_slug: company.slug,
    },
  }
  if (redirectTo) inviteOptions.redirectTo = redirectTo

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    inviteOptions,
  )

  if (inviteError || !invited.user) {
    const message = inviteError?.message || 'invite_failed'
    const status = /already|registered|exists/i.test(message) ? 409 : 400
    return json({ error: message }, status)
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: invited.user.id,
      email,
      full_name: fullName || null,
    }, { onConflict: 'id' })

  if (profileError) return json({ error: 'profile_setup_failed' }, 500)

  const { data: membership, error: saveMembershipError } = await adminClient
    .from('company_members')
    .upsert({
      company_id: companyId,
      user_id: invited.user.id,
      role,
      is_active: true,
    }, { onConflict: 'company_id,user_id' })
    .select('user_id, role, is_active, joined_at')
    .single()

  if (saveMembershipError) return json({ error: 'membership_setup_failed' }, 500)

  return json({
    ok: true,
    company: { id: company.id, name: company.name, slug: company.slug },
    user: { id: invited.user.id, email, full_name: fullName || null },
    membership,
  }, 201)
})
