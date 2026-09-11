# Puesta en marcha · EP Consultora

## 1. Requisitos

- Node.js 22 recomendado.
- Un proyecto Supabase.
- Acceso al repositorio GitHub.
- Render para el frontend de producción.

## 2. Instalar el proyecto

```bash
git clone https://github.com/AgustinWojtyszyn/Aplicacion_de_SGI.git
cd Aplicacion_de_SGI
npm install
cp .env.example .env
```

Completar `.env`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

Nunca subir `.env` ni una `service_role` al repositorio o al frontend.

## 3. Base de datos

Aplicar las **12 migraciones** en este orden:

1. `supabase/migrations/20260908221500_stage1_foundation.sql`
2. `supabase/migrations/20260908230000_stage1_integrity_hardening.sql`
3. `supabase/migrations/20260908230500_document_delete_storage_policy.sql`
4. `supabase/migrations/20260909170000_user_access_management.sql`
5. `supabase/migrations/20260909213000_stage2_sgi_workflow.sql`
6. `supabase/migrations/20260909214500_stage2_permissions_hardening.sql`
7. `supabase/migrations/20260909215500_stage2_review_lock.sql`
8. `supabase/migrations/20260909220500_public_registration.sql`
9. `supabase/migrations/20260909223000_sgi_dashboard_metrics.sql`
10. `supabase/migrations/20260909224000_sgi_due_reminders.sql`
11. `supabase/migrations/20260910194000_multi_company_tenant_access.sql`
12. `supabase/migrations/20260911103000_ep_consultora_platform_admins.sql`

Estas migraciones crean y endurecen perfiles, empresas y membresías, roles, módulos, documentos, comentarios, actividad, control de versiones, requisitos ISO/SGI, notificaciones internas, métricas, recordatorios, Storage privado, aislamiento multiempresa y RLS.

La migración 12 separa explícitamente al **administrador global de EP Consultora** de los administradores de cada empresa cliente.

### Supabase CLI

Si el proyecto está vinculado:

```bash
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

También pueden ejecutarse los SQL manualmente desde el SQL Editor, respetando exactamente el orden anterior.

## 4. Administración global

La tabla `platform_admins` identifica a quienes pueden crear y supervisar empresas desde EP Consultora.

En una instalación existente, la migración 12 conserva el acceso promoviendo como administrador global únicamente al administrador activo más antiguo cuando todavía no existe ninguno explícito.

Un administrador de empresa mantiene rol `admin` dentro de su espacio, pero no puede administrar el catálogo global de empresas ni abrir otros clientes.

## 5. Crear una empresa y su primer administrador

Desde **Empresas**, el administrador global completa:

1. nombre de la empresa;
2. slug/identificador de acceso;
3. nombre del primer administrador;
4. correo del primer administrador.

EP Consultora crea el espacio, carga la estructura base SGI/ISO y utiliza la Edge Function `invite-user` para enviar la invitación del primer administrador.

Publicar la función:

```bash
npx supabase functions deploy invite-user --project-ref TU_PROJECT_REF
```

El primer administrador crea su contraseña desde `/set-password` y, una vez dentro, puede gestionar los usuarios de su empresa desde **Usuarios**.

## 6. Registro público

Cada empresa utiliza su propia ruta de acceso:

```text
/login/slug-de-la-empresa
```

Desde esa pantalla el registro es público y queda asociado a la empresa seleccionada.

Después de registrarse:

1. el usuario confirma su correo si Supabase tiene confirmación habilitada;
2. la cuenta queda registrada con membresía pendiente/inactiva;
3. un administrador de esa empresa entra a **Usuarios** y activa la membresía;
4. recién entonces RLS permite acceder a la documentación de ese espacio.

## 7. URLs de Auth

En **Supabase → Authentication → URL Configuration** configurar el Site URL y las Redirect URLs.

Para desarrollo incluir como mínimo:

```text
http://localhost:3000
http://localhost:3000/set-password
http://localhost:3000/login/SLUG-DE-EMPRESA
```

Cuando exista la URL de producción, agregar también el dominio público, `/set-password` y las rutas `/login/<slug>` utilizadas.

## 8. Desarrollo local

```bash
npm run dev
```

Abrir `http://localhost:3000`.

## 9. Verificaciones

```bash
npm run test:run
npm run build
```

GitHub Actions ejecuta ambas verificaciones automáticamente en cada push a `main`.

## 10. Storage

El bucket `sgi-documents` es privado.

Los documentos se almacenan dentro del espacio correspondiente y se abren mediante URLs firmadas de corta duración. Las políticas de Storage y PostgreSQL validan empresa, membresía activa y permisos.

## 11. Deploy en Render

El repositorio incluye `render.yaml` para `ep-consultora`.

En Render configurar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

El frontend se publica como sitio estático Vite y las rutas se reescriben a `index.html` para que React Router funcione al recargar.

Antes de desplegar, seguir `docs/PRODUCTION_CHECKLIST.md`.
