# Puesta en marcha · SF Higiene SGI

## 1. Requisitos

- Node.js 22 recomendado.
- Un proyecto de Supabase.
- Acceso al repositorio GitHub.
- Render para el despliegue web cuando se habilite producción.

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

Ejecutar las migraciones en orden:

1. `supabase/migrations/20260908221500_stage1_foundation.sql`
2. `supabase/migrations/20260908230000_stage1_integrity_hardening.sql`
3. `supabase/migrations/20260908230500_document_delete_storage_policy.sql`
4. `supabase/migrations/20260909170000_user_access_management.sql`

La base crea perfiles, SF Higiene, miembros/roles, módulos, documentos, observaciones, actividad, Storage privado y RLS. La última migración incorpora activación/desactivación de membresías y protege al último administrador activo.

### Aplicación con Supabase CLI

Si el proyecto está vinculado con Supabase CLI:

```bash
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

También pueden ejecutarse los SQL desde el SQL Editor de Supabase, respetando el orden anterior.

## 4. Primer usuario administrador

Crear el primer usuario desde **Supabase → Authentication → Users**.

Al iniciar sesión por primera vez, la app llama a `bootstrap_sf_higiene_admin()`.

- Si SF Higiene todavía no tiene ningún miembro, ese primer usuario se convierte en `admin`.
- En cuanto existe un miembro, la función deja de conceder permisos automáticamente.

Esto evita que cuentas posteriores puedan autoconcederse acceso administrativo.

## 5. Usuarios posteriores

Los usuarios posteriores se gestionan desde **Usuarios** dentro de la aplicación.

El administrador puede:

- enviar una invitación por correo;
- elegir el rol inicial (`admin`, `responsible` o `member`);
- cambiar el rol luego;
- activar o desactivar el acceso.

La invitación se procesa en `supabase/functions/invite-user`, donde Supabase permite usar privilegios administrativos sin exponer la `service_role` al navegador.

Publicar la función:

```bash
npx supabase functions deploy invite-user
```

En **Authentication → URL Configuration → Redirect URLs** agregar las URLs autorizadas para establecer contraseña, por ejemplo:

```text
http://localhost:3000/set-password
```

## 6. Desarrollo local

```bash
npm run dev
```

Abrir `http://localhost:3000`.

La guía detallada del circuito de usuarios está en `docs/USER_ACCESS_TESTING.md`.

## 7. Verificaciones

```bash
npm run test:run
npm run build
```

GitHub Actions ejecuta ambos comandos automáticamente en cada push a `main`.

## 8. Render

El repositorio incluye `render.yaml`.

En Render configurar las variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

El deploy se construye como sitio estático Vite y reescribe las rutas hacia `index.html` para que React Router funcione al recargar.

## 9. Storage

El bucket `sgi-documents` es **privado**.

Los documentos se guardan con esta estructura:

```text
<company_id>/<document_id>/<timestamp>-<archivo>
```

Los archivos se abren mediante URLs firmadas de corta duración. Las políticas RLS de Storage validan la pertenencia activa del usuario a la empresa.
