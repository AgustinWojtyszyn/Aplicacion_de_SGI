import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const appUrl = (Deno.env.get('APP_URL') || 'https://aplicacion-de-sgi-1.onrender.com').replace(/\/+$/, '')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function deliveryState(lastEvent?: string | null) {
  const event = (lastEvent || '').toLowerCase()
  if (['delivered', 'opened', 'clicked'].includes(event)) return { delivered: true, failed: false }
  if (['bounced', 'complained', 'failed', 'canceled'].includes(event)) return { delivered: false, failed: true }
  return { delivered: false, failed: false }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const emailFrom = Deno.env.get('REVIEW_EMAIL_FROM')
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
    action?: 'send' | 'status'
    companyId?: string
    documentId?: string
    recipientUserId?: string
    emailId?: string
    note?: string
  }

  try {
    payload = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const action = payload.action || 'send'
  const companyId = payload.companyId?.trim()
  const documentId = payload.documentId?.trim()

  if (!companyId || !documentId) return json({ error: 'invalid_request' }, 400)

  const [{ data: platformAdmin }, { data: membership }, { data: document, error: documentError }] = await Promise.all([
    adminClient.from('platform_admins').select('user_id').eq('user_id', authData.user.id).maybeSingle(),
    adminClient
      .from('company_members')
      .select('role, is_active')
      .eq('company_id', companyId)
      .eq('user_id', authData.user.id)
      .eq('is_active', true)
      .maybeSingle(),
    adminClient
      .from('documents')
      .select('id, company_id, title, document_type, status, created_by, responsible_id, reviewer_id, approver_id')
      .eq('id', documentId)
      .eq('company_id', companyId)
      .maybeSingle(),
  ])

  if (documentError || !document) return json({ error: 'document_not_found' }, 404)
  if (!platformAdmin && !membership) return json({ error: 'not_authorized' }, 403)

  const canSend = Boolean(
    platformAdmin
      || membership?.role === 'admin'
      || membership?.role === 'responsible'
      || document.created_by === authData.user.id
      || document.responsible_id === authData.user.id,
  )

  if (!canSend) return json({ error: 'not_authorized' }, 403)

  if (!resendApiKey) return json({ error: 'resend_not_configured' }, 500)

  if (action === 'status') {
    const emailId = payload.emailId?.trim()
    if (!emailId) return json({ error: 'email_id_required' }, 400)

    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return json({ error: data?.message || data?.name || 'email_status_failed' }, response.status)

    const state = deliveryState(data?.last_event)
    const actionName = state.delivered ? 'review_email_delivered' : state.failed ? 'review_email_failed' : null

    if (actionName) {
      const { data: existing } = await adminClient
        .from('document_activity')
        .select('id')
        .eq('document_id', documentId)
        .eq('action', actionName)
        .contains('details', { email_id: emailId })
        .limit(1)

      if (!existing?.length) {
        await adminClient.from('document_activity').insert({
          document_id: documentId,
          actor_id: authData.user.id,
          action: actionName,
          details: {
            email_id: emailId,
            provider_status: data?.last_event || null,
            to: Array.isArray(data?.to) ? data.to[0] : null,
          },
        })
      }
    }

    return json({
      ok: true,
      emailId,
      status: data?.last_event || 'unknown',
      delivered: state.delivered,
      failed: state.failed,
      to: data?.to || [],
    })
  }

  if (!emailFrom) return json({ error: 'review_email_from_not_configured' }, 500)

  const recipientUserId = payload.recipientUserId?.trim()
  if (!recipientUserId) return json({ error: 'recipient_required' }, 400)

  const [{ data: recipientMembership }, { data: recipient }, { data: company }, { data: sender }] = await Promise.all([
    adminClient
      .from('company_members')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('user_id', recipientUserId)
      .eq('is_active', true)
      .maybeSingle(),
    adminClient.from('profiles').select('id, full_name, email').eq('id', recipientUserId).maybeSingle(),
    adminClient.from('companies').select('id, name').eq('id', companyId).maybeSingle(),
    adminClient.from('profiles').select('id, full_name, email').eq('id', authData.user.id).maybeSingle(),
  ])

  if (!recipientMembership || !recipient?.email) return json({ error: 'recipient_not_available' }, 400)
  if (!company) return json({ error: 'company_not_found' }, 404)

  const note = payload.note?.trim() || ''
  const recipientName = recipient.full_name || recipient.email
  const senderName = sender?.full_name || sender?.email || 'EP Consultora'
  const safeTitle = escapeHtml(document.title)
  const safeCompany = escapeHtml(company.name)
  const safeRecipient = escapeHtml(recipientName)
  const safeSender = escapeHtml(senderName)
  const safeNote = escapeHtml(note).replaceAll('\n', '<br />')
  const documentsUrl = `${appUrl}/documents`

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [recipient.email],
      subject: `Revisión requerida · ${document.title}`,
      text: [
        `Hola ${recipientName},`,
        '',
        `${senderName} te envió un documento para revisión en ${company.name}.`,
        `Documento: ${document.title}`,
        note ? `Nota: ${note}` : '',
        '',
        `Abrir documentos: ${documentsUrl}`,
      ].filter(Boolean).join('\n'),
      html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#17312f">
        <p>Hola ${safeRecipient},</p>
        <p><strong>${safeSender}</strong> te envió un documento para revisión en <strong>${safeCompany}</strong>.</p>
        <p><strong>Documento:</strong> ${safeTitle}</p>
        ${safeNote ? `<p><strong>Nota:</strong><br />${safeNote}</p>` : ''}
        <p><a href="${documentsUrl}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#0d5c55;color:#fff;text-decoration:none;font-weight:700">Abrir documentos</a></p>
        <p style="color:#68817e;font-size:12px">EP Consultora · notificación del flujo documental</p>
      </div>`,
    }),
  })

  const resendData = await resendResponse.json().catch(() => ({}))
  if (!resendResponse.ok || !resendData?.id) {
    return json({ error: resendData?.message || resendData?.name || 'email_send_failed' }, resendResponse.status || 500)
  }

  await adminClient.from('document_activity').insert({
    document_id: documentId,
    actor_id: authData.user.id,
    action: 'review_email_sent',
    details: {
      email_id: resendData.id,
      recipient_id: recipient.id,
      recipient_name: recipientName,
      recipient_email: recipient.email,
      comment: note || null,
      provider_status: 'sent',
    },
  })

  return json({
    ok: true,
    emailId: resendData.id,
    status: 'sent',
    delivered: false,
    failed: false,
    recipient: {
      id: recipient.id,
      name: recipientName,
      email: recipient.email,
    },
  }, 201)
})
