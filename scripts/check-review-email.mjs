#!/usr/bin/env node
// Public, read-only diagnostic: no credentials and no emails are sent.
const projectRef = process.argv[2] || process.env.SUPABASE_PROJECT_REF
if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef)) {
  console.error('Uso: node scripts/check-review-email.mjs <project-ref-de-Supabase>')
  process.exitCode = 2
} else {
  const url = `https://${projectRef}.supabase.co/functions/v1/send-review-email`
  const origin = 'https://aplicacion-de-sgi-1.onrender.com'

  async function probe(method, headers = {}) {
    try {
      const response = await fetch(url, {
        method,
        headers: { Origin: origin, ...headers },
        signal: AbortSignal.timeout(12000),
      })
      const body = await response.text()
      return {
        status: response.status,
        allowOrigin: response.headers.get('access-control-allow-origin'),
        allowHeaders: response.headers.get('access-control-allow-headers'),
        body: body.slice(0, 250),
      }
    } catch (error) {
      return { error: error.message || String(error) }
    }
  }

  // OPTIONS should succeed without credentials; GET should return the function's 405.
  const preflight = await probe('OPTIONS', {
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type,apikey,x-client-info',
  })
  const get = await probe('GET')

  console.log('Preflight OPTIONS:', preflight)
  console.log('GET sin credenciales:', get)

  if (preflight.error || get.error) {
    console.error('Falla de conexión/DNS/TLS. Verificá la URL pública y la red.')
    process.exitCode = 1
  } else if (preflight.status === 404 || get.status === 404) {
    console.error('Función no encontrada en este proyecto. Revisá el proyecto y el deploy.')
    process.exitCode = 1
  } else if (preflight.status !== 200 || !preflight.allowOrigin) {
    console.error('Preflight bloqueado: revisá verify_jwt y CORS en el despliegue activo.')
    process.exitCode = 1
  } else if (get.status !== 405 || !get.body.includes('method_not_allowed')) {
    console.error('La función existe, pero no responde como el código esperado. Revisá versión y gateway.')
    process.exitCode = 1
  } else {
    console.log('OK: función publicada y CORS operativo. Falta un envío autenticado para verificar Resend.')
  }
}
