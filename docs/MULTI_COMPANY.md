# Multiempresa · flujo de acceso y aislamiento

EP Consultora usa un modelo multiempresa. Cada organización tiene su propio espacio documental y SGI.

## Roles administrativos

- **Administrador global de EP Consultora**: crea empresas, puede recorrer todos los espacios y asigna el primer administrador de cada cliente.
- **Administrador de empresa**: gestiona usuarios y documentación únicamente dentro de su empresa.
- **Responsable / miembro**: opera dentro de las capacidades asignadas en su empresa.

Los administradores de empresa no son administradores globales.

## Flujo de acceso

1. La ruta `/` **no muestra el directorio público de otras empresas**. Solicita el código/slug de la empresa o permite volver al último espacio conocido en ese dispositivo.
2. Cada administrador comparte con sus usuarios la dirección `/login/:companySlug` o el código de acceso de su empresa. El backend valida el slug sin enumerar todas las organizaciones.
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

## Gestión delegada de varias empresas

El esquema `company_members` permite asociar a una misma persona con varias empresas,
con un rol y estado independientes por empresa. No se requiere un rol global nuevo.

1. Desde `Usuarios`, el administrador global elige **Asignar empresa a usuario**.
2. Selecciona una cuenta ya existente, la empresa y el rol (por ejemplo, **Administrador**).
3. Repite el proceso para cada empresa que quiera delegar.
4. El gestor utiliza el selector **Empresa** en la barra superior para cambiar entre las empresas activas que tenga asignadas. Su rol cambia con el espacio.
5. Para retirar acceso, se desactiva la membresía únicamente en esa empresa desde `Usuarios`.

Si la persona todavía no tiene cuenta, primero hay que invitarla desde una empresa.
Las empresas que no tiene asignadas no aparecen en el selector interno y siguen
protegidas por RLS en documentos, trabajos, SGI y archivos de Storage.

**Separación importante:** el rol `admin` de una membresía no incluye acceso a
`Empresas` (administración global). Solo un usuario de `platform_admins`
puede crear empresas, asignar usuarios a distintas empresas y ver todo el conjunto.

Esta funcionalidad aprovecha las tablas, políticas RLS y permisos de INSERT ya
existentes. Si la instalación tiene todas las migraciones previas aplicadas,
no requiere SQL nuevo ni despliegue de Edge Functions.

### Verificaciones de aceptación

- Gestor asignado a A y B: puede ver/cambiar entre A y B, y gestionar usuarios de cada una.
- Gestor sin acceso a C: no aparece C en su selector y las consultas directas a C deben ser denegadas por RLS.
- Gestor con rol admin en A y miembro en B: permisos de admin solo en A.
- Al desactivar la membresía en B, la siguiente carga o cambio de espacio debe revocar B.
- Administrador global: conserva acceso a todas las empresas y al menú Empresas.

## Privacidad del directorio y puesta en producción

La migración `20261030150000_hide_public_company_directory.sql` revoca el listado público `list_login_companies()`; se mantiene `get_login_company(text)` para resolver un único código conocido en el acceso por enlace. La visibilidad de la documentación, empresas y usuarios continúa protegida por RLS y membresías existentes.

Subir el frontend a `main` no aplica automáticamente esta migración a un Supabase de producción. Ejecutarla en GESTIQA para cerrar también el directorio RPC. Comprobar que `anon` y `authenticated` no tengan ejecución sobre `list_login_companies()` y que `get_login_company(text)` siga resolviendo un slug activo. El administrador global conserva el selector y la gestión de empresas; los usuarios comunes no ven empresas sin membresía.
