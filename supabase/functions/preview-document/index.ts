import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

// No client-supplied Storage path is trusted: resolve the object from the
// authenticated document/version record only. No signed URLs are issued here.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json('method_not_allowed', 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = request.headers.get('Authorization')
  if (!url || !serviceKey) return json('server_not_configured', 500)
  if (!authHeader?.startsWith('Bearer ')) return json('not_authenticated', 401)

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await client.auth.getUser(authHeader.slice(7))
  if (authError || !authData.user) return json('not_authenticated', 401)

  let payload: { documentId?: string; versionId?: string | null }
  try {
    payload = await request.json()
  } catch {
    return json('invalid_json', 400)
  }
  if (!payload.documentId || !/^[a-f0-9-]{36}$/i.test(payload.documentId)) {
    return json('invalid_document', 400)
  }
  if (payload.versionId && !/^[a-f0-9-]{36}$/i.test(payload.versionId)) {
    return json('invalid_version', 400)
  }

  const { data: document, error: documentError } = await client
    .from('documents')
    .select('id, company_id, file_path, mime_type')
    .eq('id', payload.documentId)
    .maybeSingle()
  if (documentError || !document) return json('document_not_found', 404)

  // Applies the same single-company rule and the active membership rule as RLS.
  const { data: allowed, error: accessError } = await client.rpc('is_company_member', {
    p_company_id: document.company_id,
    p_user_id: authData.user.id,
  })
  if (accessError || !allowed) return json('not_authorized', 403)

  let filePath = document.file_path as string
  let mimeType = document.mime_type as string
  if (payload.versionId) {
    const { data: version, error: versionError } = await client
      .from('document_versions')
      .select('file_path, mime_type')
      .eq('id', payload.versionId)
      .eq('document_id', document.id)
      .maybeSingle()
    if (versionError || !version) return json('version_not_found', 404)
    filePath = version.file_path
    mimeType = version.mime_type
  }

  // Prevent acting as a proxy for dangerous HTML, scripts or arbitrary blobs.
  if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
    return json('preview_not_supported', 415)
  }
  if (!filePath.startsWith(document.company_id + '/')) return json('invalid_document_path', 403)

  const { data: file, error: fileError } = await client.storage
    .from('sgi-documents')
    .download(filePath)
  if (fileError || !file) return json('file_unavailable', 404)

  return new Response(file, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': mimeType,
      'Content-Disposition': 'inline; filename="documento"',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, private',
    },
  })
})
