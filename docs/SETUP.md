# Puesta en marcha · IntegraFlow

## 1. Requisitos

- Node.js 22 recomendado.
- Un proyecto Supabase.
- Acceso al repositorio GitHub.
- Render únicamente cuando se habilite el despliegue final.

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

Aplicar las migraciones en este orden:

1. `supabase/migrations/20260908221500_stage1_foundation.sql`
2. `supabase/migrations/20260908230000_stage1_integrity_hardening.sql`
3. `supabase/migrations/20260908230500_document_delete_storage_policy.sql`
4. `supabase/migrations/20260909170000_user_access_management.sql`
5. `supabase/migrations/20260909213000_stage2_sgi_workflow.sql`
6. `supabase/migrations/20260909214500_stage2_permissions_hardening.sql`
7. `supabase/migrations/20260909215500_stage2_review_lock.sql`
8. `supabase/migrations/20260909220500_public_registration.sql`

Estas migraciones crean y endurecen perfiles, membresías, roles, módulos, documentos, comentarios, actividad, control de versiones, requisitos ISO/SGI, notificaciones internas, Storage privado y RLS.

### Supabase CLI

Si el proyecto está vinculado:

```bash
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

También pueden ejecutarse los SQL manualmente desde el SQL Editor, respetando exactamente el orden anterior.

## 4. Primer administrador

La instalación actual conserva un bootstrap controlado para inicializar el primer administrador del espacio de trabajo.

- El bootstrap solo funciona mientras todavía no exista ningún miembro.
- Después deja de conceder privilegios automáticamente.
- Los usuarios nuevos quedan como miembros pendientes/inactivos hasta que un administrador los habilita.

## 5. Registro público y usuarios

El registro desde `/login` es público.

Después de registrarse:

1. el usuario confirma su correo si el proyecto Supabase tiene confirmación habilitada;
2. la cuenta queda registrada pero sin acceso a documentación;
3. un administrador entra a **Usuarios** y activa la membresía;
4. recién entonces RLS permite acceder al espacio de trabajo.

El administrador también puede enviar invitaciones desde la propia aplicación mediante la Edge Function `invite-user`.

Publicarla si se utilizará ese flujo:

```bash
npx supabase functions deploy invite-user --project-ref TU_PROJECT_REF
```

## 6. URLs de Auth

En **Supabase → Authentication → URL Configuration** configurar el Site URL y las Redirect URLs.

Para desarrollo:

```text
http://localhost:3000
http://localhost:3000/set-password
```

Cuando exista la URL de producción, agregar también:

```text
https://TU-DOMINIO/set-password
```

## 7. Desarrollo local

```bash
npm run dev
```

Abrir `http://localhost:3000`.

## 8. Verificaciones

```bash
npm run test:run
npm run build
```

GitHub Actions ejecuta ambas verificaciones automáticamente en cada push a `main`.

## 9. Storage

El bucket `sgi-documents` es privado.

Los documentos se almacenan dentro del espacio correspondiente y se abren mediante URLs firmadas de corta duración. Las políticas de Storage y PostgreSQL validan membresía activa y permisos.

## 10. Deploy final

El repositorio incluye `render.yaml` con el servicio `integraflow`.

En Render configurar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

El frontend se publica como sitio estático Vite y las rutas se reescriben a `index.html` para que React Router funcione al recargar.

Antes de desplegar, seguir `docs/PRODUCTION_CHECKLIST.md`.
