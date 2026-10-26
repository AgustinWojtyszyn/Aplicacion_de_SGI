# Diagnóstico y despliegue: correo de revisión

El frontend llama a `supabase.functions.invoke('send-review-email')`, que requiere una Edge Function **publicada en el mismo proyecto Supabase configurado en Render**.

## Publicación controlada

1. Verificar el proyecto de producción en Render: variable `VITE_SUPABASE_URL` (solo dominio del proyecto; no compartir claves).
2. Iniciar sesión con Supabase CLI y confirmar acceso al mismo proyecto: `supabase projects list`.
3. En la raíz del repositorio, desplegar **únicamente** esta función:
   ```bash
   npx supabase functions deploy send-review-email --project-ref <PROJECT_REF>
   ```
4. La configuración `supabase/config.toml` define `verify_jwt = false` para permitir el preflight. **No es un endpoint de envío público**: la función exige un JWT, verifica el usuario mediante `auth.getUser(token)` y comprueba su autorización para la empresa y documento.
5. En Supabase → Edge Functions → `send-review-email` → Logs / Invocations, comprobar la primera llamada. En Supabase → Edge Functions → Secrets, verificar **sin revelar valores** que existan:
   - `RESEND_API_KEY`
   - `REVIEW_EMAIL_FROM` (dominio validado por Resend)
   - `APP_URL` (opcional, enlace al frontend)
   - Las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` se inyectan normalmente por el runtime.
6. Probar la disponibilidad **sin enviar correos**:
   ```bash
   node scripts/check-review-email.mjs <PROJECT_REF>
   ```
   Esperado: `OPTIONS 200` con CORS y `GET 405` con `method_not_allowed`.
7. Ejecutar un solo envío real desde la aplicación con usuario autorizado y comprobar la entrega en Resend, el historial documental y el correo del destinatario.

**Diagnóstico:** si la respuesta es 404, función inexistente o proyecto incorrecto; si OPTIONS no devuelve CORS, gateway/preflight/versión sin desplegar; si OPTIONS/GET funcionan pero el POST falla, consultar Logs / Invocations y secretos. La revisión documental ya registrada no debe repetirse solo por una falla de correo.

No se necesita SQL para desplegar o configurar esta Edge Function. Nunca subir claves Resend ni service_role a GitHub o al frontend.
