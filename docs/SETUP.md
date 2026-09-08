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

La primera migración crea:

- perfiles;
- empresa SF Higiene;
- miembros y roles;
- módulos iniciales;
- documentos;
- observaciones;
- historial de actividad;
- bucket privado `sgi-documents`;
- RLS y políticas de Storage;
- datos iniciales de módulos.

La segunda agrega validaciones de integridad y refuerza el historial documental.

### Aplicación con Supabase CLI

Si el proyecto está vinculado con Supabase CLI:

```bash
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

También pueden ejecutarse los SQL desde el SQL Editor de Supabase, respetando el orden anterior.

## 4. Primer usuario administrador

Crear el primer usuario desde **Supabase → Authentication → Users**.

Al iniciar sesión por primera vez, la app llama a `bootstrap_sf_higiene_admin()`.

- Si SF Higiene todavía no tiene ningún miembro, ese primer usuario se convierte en `admin`.
- En cuanto existe un miembro, la función deja de conceder permisos automáticamente.

Esto evita que cuentas posteriores puedan autoconcederse acceso administrativo.

## 5. Usuarios posteriores

Crear las cuentas desde Authentication. Después asociarlas a SF Higiene en `company_members`.

Ejemplo de consulta para obtener IDs:

```sql
select id, email
from public.profiles
order by email;
```

Ejemplo para asignar una cuenta existente como miembro:

```sql
insert into public.company_members (company_id, user_id, role)
select c.id, p.id, 'member'::public.company_role
from public.companies c
join public.profiles p on lower(p.email) = lower('usuario@empresa.com')
where c.slug = 'sf-higiene'
on conflict (company_id, user_id) do update
set role = excluded.role;
```

Roles de Etapa 1:

- `admin`: administración del espacio.
- `responsible`: responsable operativo/documental.
- `member`: usuario interno.

## 6. Desarrollo local

```bash
npm run dev
```

Abrir `http://localhost:3000`.

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

Los archivos se abren mediante URLs firmadas de corta duración. Las políticas RLS de Storage validan la pertenencia del usuario a la empresa.
