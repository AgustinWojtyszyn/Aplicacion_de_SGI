# Multiempresa · flujo de acceso y aislamiento

EP Consultora usa un modelo multiempresa. Cada organización tiene su propio espacio documental y SGI.

## Roles administrativos

- **Administrador global de EP Consultora**: crea empresas, puede recorrer todos los espacios y asigna el primer administrador de cada cliente.
- **Administrador de empresa**: gestiona usuarios y documentación únicamente dentro de su empresa.
- **Responsable / miembro**: opera dentro de las capacidades asignadas en su empresa.

Los administradores de empresa no son administradores globales.

## Flujo de acceso

1. La ruta `/` muestra únicamente el directorio mínimo de empresas activas (`id`, `name`, `slug`).
2. El usuario elige su empresa antes de autenticarse.
3. El login queda en `/login/:companySlug`.
4. El registro público guarda `company_slug` en los metadatos de Auth.
5. El trigger de alta crea una membresía `member` inactiva para esa empresa.
6. Un administrador de esa empresa habilita la cuenta desde `Usuarios`.
7. Una cuenta normal solo puede abrir espacios donde tenga una membresía activa.

## Alta de empresas

El administrador global dispone de `/companies` (`Empresas` en la navegación).

Al crear un espacio debe completar:

- nombre de la empresa;
- identificador/slug de acceso;
- nombre del primer administrador;
- correo del primer administrador.

El sistema crea el espacio, carga módulos y requisitos SGI/ISO base y envía una invitación al primer administrador con rol `admin` para esa empresa.

Después, ese administrador puede invitar usuarios adicionales o habilitar registros públicos pendientes desde `Usuarios`.

## Aislamiento

Los documentos, módulos, requisitos SGI y archivos de Storage están vinculados por `company_id`.

- Usuarios normales: RLS exige membresía activa de la empresa.
- Responsables: mantienen sus permisos funcionales dentro del espacio habilitado.
- Administradores de empresa: administran solo su propio espacio.
- Administradores globales: pueden supervisar todas las empresas y cambiar el contexto activo desde la barra superior.
- Los documentos nunca se copian al crear otra empresa.

## Migraciones necesarias

Aplicar todas las migraciones del repositorio en orden. Para el modelo multiempresa actual son especialmente relevantes:

- `supabase/migrations/20260910194000_multi_company_tenant_access.sql`
- `supabase/migrations/20260911103000_ep_consultora_platform_admins.sql`

La última migración separa administradores globales de administradores de empresa y elimina la dependencia de una empresa plantilla fija.

## Edge Function de invitaciones

El flujo de primer administrador y las invitaciones desde `Usuarios` usan:

```bash
npx supabase functions deploy invite-user --project-ref TU_PROJECT_REF
```

La función autoriza al administrador global para cualquier empresa y al administrador de empresa únicamente para su propio espacio.

## Prueba mínima recomendada

1. Ingresar como administrador global.
2. Crear una segunda empresa desde `Empresas`, incluyendo el correo de su primer administrador.
3. Confirmar que ese correo recibe la invitación y puede establecer contraseña.
4. Ingresar con ese administrador y verificar que ve `Usuarios`, pero no `Empresas`.
5. Registrar un usuario público en esa empresa y confirmar que queda pendiente.
6. Habilitarlo desde `Usuarios`.
7. Crear documentos en dos empresas distintas.
8. Confirmar que el usuario normal solo ve documentación de su empresa.
9. Confirmar que el administrador global sí puede cambiar entre espacios.
