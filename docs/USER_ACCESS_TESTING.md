# Prueba local · usuarios, invitaciones y contraseñas

Esta guía valida el circuito completo de acceso de EP Consultora sin desplegar el frontend en Render.

## 1. Traer el código

```bash
git switch main
git pull
npm install
```

## 2. Aplicar base de datos

Con Supabase CLI vinculado al proyecto:

```bash
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

Si preferís SQL Editor, ejecutar todas las migraciones pendientes en orden. Para el modelo actual son especialmente importantes:

```text
supabase/migrations/20260910194000_multi_company_tenant_access.sql
supabase/migrations/20260911103000_ep_consultora_platform_admins.sql
```

## 3. Publicar la Edge Function de invitación

La invitación usa `auth.admin.inviteUserByEmail`, por lo que debe ejecutarse del lado servidor. La `service_role` nunca se coloca en `.env` del frontend.

```bash
npx supabase functions deploy invite-user
```

Supabase provee `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` automáticamente a la función alojada.

## 4. Autorizar URLs para correos

En Supabase ir a **Authentication → URL Configuration → Redirect URLs** y agregar:

```text
http://localhost:3000/set-password
http://localhost:3000/login/SLUG-DE-EMPRESA
```

Conservar también la URL de producción cuando exista.

## 5. Levantar Vite

El `.env` local solo necesita las credenciales públicas:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

Luego:

```bash
npm run dev
```

Abrir `http://localhost:3000`.

## 6. Caso administrador global

1. Iniciar sesión con el administrador global de EP Consultora.
2. Confirmar que aparecen **Usuarios** y **Empresas**.
3. Entrar a **Empresas**.
4. Crear una empresa indicando nombre, slug, nombre del primer administrador y correo.
5. Confirmar que la empresa queda creada y que se envía la invitación.

## 7. Primer administrador de empresa

1. Abrir la invitación recibida en incógnito u otro navegador.
2. Crear una contraseña de 8 o más caracteres desde `/set-password`.
3. Ingresar a la empresa correspondiente.
4. Confirmar que aparece **Usuarios**.
5. Confirmar que **Empresas** NO aparece.
6. Escribir manualmente `/companies`: debe redirigir y no permitir administración global.

## 8. Invitación de usuarios

Desde el administrador de empresa:

1. Entrar a **Usuarios**.
2. Pulsar **Invitar usuario**.
3. Completar nombre, correo y rol.
4. Confirmar que aparece el mensaje de invitación enviada.
5. Abrir el correo y crear contraseña desde `/set-password`.
6. Confirmar que el usuario entra únicamente al espacio de esa empresa.

## 9. Registro público

1. Abrir `/login/slug-de-la-empresa` sin sesión.
2. Pulsar registro.
3. Crear una cuenta nueva.
4. Confirmar correo si está habilitado.
5. Verificar que la cuenta queda pendiente y no puede leer documentación.
6. Activarla desde **Usuarios**.
7. Recargar y confirmar que recién entonces obtiene acceso.

## 10. Roles y permisos documentales

### Miembro

- Puede ver documentos de su empresa.
- Puede crear documentos.
- Si creó un documento o quedó asignado como responsable, puede editarlo y avanzar su estado.
- En documentos ajenos donde no es responsable, no debe ver **Editar** ni el botón de avance de estado.
- Solo puede eliminar un documento propio mientras siga en `Borrador`.

### Responsable

- No debe aparecer **Usuarios**.
- Debe poder editar y avanzar documentos según las reglas funcionales.

### Administrador de empresa

- Ve y administra usuarios de su empresa.
- Puede editar/avanzar documentos de su empresa.
- No puede cambiar a otra empresa ni administrar el catálogo global.

### Administrador global

- Puede cambiar de empresa.
- Puede crear empresas.
- Puede gestionar usuarios dentro del espacio que tenga seleccionado.

## 11. Desactivar y reactivar

1. Desde admin de empresa, desactivar una cuenta de prueba.
2. En la sesión de prueba, recargar la página.
3. Debe aparecer la pantalla de acceso pendiente/sin membresía activa.
4. Los accesos a datos quedan bloqueados por RLS aunque la sesión de Auth todavía exista.
5. Reactivar desde admin.
6. Recargar y confirmar que vuelve a entrar.

La base de datos impide dejar a una empresa sin ningún administrador activo.

## 12. Recuperación de contraseña

1. Cerrar sesión con una cuenta de prueba.
2. En Login, pulsar **¿Olvidaste tu contraseña?**.
3. Escribir el correo y enviar.
4. Abrir el correo recibido.
5. Debe volver a `/set-password`.
6. Guardar una contraseña nueva.
7. Confirmar que la contraseña anterior deja de funcionar y la nueva inicia sesión correctamente.

## 13. Tests automáticos

```bash
npm run test:run
npm run build
```

Ambos deben terminar sin errores. GitHub Actions ejecuta las mismas verificaciones en cada push a `main`.
