import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const BUCKET = 'sgi-documents'
const BATCH_SIZE = 100
const MAX_BATCHES = 12

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function publicError(message: string) {
  for (const code of [
    'not_authenticated', 'not_authorized', 'company_not_found',
    'system_company_cannot_be_deleted', 'company_name_mismatch',
  ]) {
    if (message.includes(code)) return code
  }
  return 'delete_failed'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authorization = request.headers.get('Authorization')
  if (!url || !serviceKey || !anonKey) return json({ error: 'server_not_configured' }, 503)
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'not_authenticated' }, 401)

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = authorization.slice(7)
  const { data: identity, error: identityError } = await service.auth.getUser(token)
  if (identityError || !identity.user) return json({ error: 'not_authenticated' }, 401)

  const { data: admin, error: adminError } = await service
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', identity.user.id)
    .maybeSingle()
  if (adminError) return json({ error: 'authorization_check_failed' }, 503)
  if (!admin) return json({ error: 'not_authorized' }, 403)

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (payload.action === 'list') {
    const { data, error } = await service
      .from('company_purge_jobs')
      .select('id, company_name, created_at, last_error')
      .is('finished_at', null)
      .order('created_at', { ascending: false })
      .limit(25)
    if (error) return json({ error: 'list_failed' }, 503)
    return json({ jobs: data ?? [] })
  }

  async function finishJob(jobId: string) {
    const { data: job, error: jobError } = await service
      .from('company_purge_jobs')
      .select('id, finished_at')
      .eq('id', jobId)
      .maybeSingle()
    if (jobError || !job) return { error: 'purge_job_not_found' }
    if (job.finished_at) return { completed: true, jobId }

    async function fail(error: unknown) {
      await service.from('company_purge_jobs')
        .update({ last_error: String(error).slice(0, 700) }).eq('id', jobId)
      return { completed: false, jobId }
    }

    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const { data: remaining, error: readError } = await service
        .from('company_purge_objects')
        .select('object_path')
        .eq('job_id', jobId)
        .order('object_path')
        .limit(BATCH_SIZE)
      if (readError) return await fail(readError.message)
      if (!remaining?.length) {
        // Revisión final: recupera objetos residuales no capturados en la primera
        // transacción (p. ej., uploads concurrentes anteriores al borrado).
        const { data: found, error: refreshError } = await service
          .rpc('refresh_company_purge_objects', { p_job_id: jobId })
        if (refreshError) return await fail(refreshError.message)
        if (Number(found) > 0) continue

        const { error: finishError } = await service.from('company_purge_jobs')
          .update({ finished_at: new Date().toISOString(), last_error: null }).eq('id', jobId)
        if (finishError) return await fail(finishError.message)
        return { completed: true, jobId }
      }

      const paths = remaining.map((row: { object_path: string }) => row.object_path)
      try {
        const { error: storageError } = await service.storage.from(BUCKET).remove(paths)
        if (storageError) return await fail(storageError.message)
      } catch (error) {
        return await fail(error)
      }

      const { error: cleanedError } = await service.from('company_purge_objects')
        .delete()
        .eq('job_id', jobId)
        .in('object_path', paths)
      if (cleanedError) return await fail(cleanedError.message)
    }
    return { completed: false, jobId }
  }

  if (payload.action === 'retry') {
    if (!validUuid(payload.jobId)) return json({ error: 'invalid_job' }, 400)
    const result = await finishJob(payload.jobId)
    if ('error' in result) return json(result, 404)
    return json(result, result.completed ? 200 : 202)
  }

  if (payload.action === 'delete') {
    if (!validUuid(payload.companyId) || typeof payload.companyName !== 'string' || !payload.companyName.trim()) {
      return json({ error: 'invalid_company' }, 400)
    }

    // Ejecutar RPC con el JWT del usuario. La función SQL valida auth.uid()
    // y la condición de administrador global antes de borrar.
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: jobId, error: purgeError } = await userClient.rpc(
      'purge_company_workspace',
      { p_company_id: payload.companyId, p_expected_name: payload.companyName },
    )
    if (purgeError) {
      const code = publicError(purgeError.message || '')
      return json({ error: code }, code === 'not_authorized' ? 403 : 409)
    }
    if (!validUuid(jobId)) return json({ error: 'invalid_purge_response' }, 503)
    const result = await finishJob(jobId)
    if ('error' in result) return json(result, 503)
    return json(result, result.completed ? 200 : 202)
  }

  return json({ error: 'invalid_action' }, 400)
})
