# Multiempresa · flujo de acceso y aislamiento

IntegraFlow usa un modelo multiempresa. Cada organización tiene su propio espacio documental y SGI, mientras que los administradores pueden supervisar todos los espacios.

## Flujo de acceso

1. La ruta `/` muestra únicamente el directorio de empresas activas (`id`, `name`, `slug`).
2. El usuario elige su empresa antes de autenticarse.
3. El login queda en `/login/:companySlug`.
4. El registro público guarda `company_slug` en los metadatos de Auth.
5. El trigger de alta crea una membresía `member` inactiva para esa empresa.
6. Un administrador habilita la cuenta desde `Usuarios`.
7. Una cuenta normal solo puede abrir el espacio de una empresa donde tenga una membresía activa.

## Aislamiento

Los documentos, módulos, requisitos SGI y archivos de Storage están vinculados por `company_id`.

- Usuarios normales: RLS exige membresía activa de la empresa.
- Responsables: mantienen sus permisos funcionales dentro del espacio habilitado.
- Administradores: se consideran administradores globales y pueden cambiar de empresa desde el selector superior.
- El cambio de empresa modifica el contexto activo; las consultas del frontend siguen filtrando por el `company_id` seleccionado.
- Los documentos nunca se copian al crear otra empresa.

## Alta de empresas

Los administradores disponen de `/companies` (`Empresas` en la navegación).

Al crear un espacio:

- se crea una nueva fila en `companies`;
- se copian los módulos base del espacio plantilla;
- se copia el catálogo de requisitos ISO/SGI;
- no se copian usuarios, documentos, versiones ni notificaciones.

## Migración necesaria

Aplicar, después de las migraciones anteriores del repositorio:

`supabase/migrations/20260910194000_multi_company_tenant_access.sql`

Si se utilizan invitaciones desde la pantalla `Usuarios`, volver a desplegar la Edge Function `invite-user` para que un administrador global pueda invitar usuarios a la empresa actualmente seleccionada.

## Prueba mínima recomendada

1. Ingresar como administrador.
2. Crear una segunda empresa desde `Empresas`.
3. Cerrar sesión y confirmar que ambas aparecen antes del login.
4. Registrar un usuario seleccionando la segunda empresa.
5. Confirmar que queda pendiente y no puede leer documentación.
6. Habilitarlo desde `Usuarios` mientras el administrador tiene seleccionada la segunda empresa.
7. Crear un documento en cada empresa.
8. Ingresar como usuario normal y confirmar que solo ve el documento de su empresa.
9. Ingresar como administrador, cambiar de empresa desde el selector superior y confirmar que puede ver ambos espacios por separado.
