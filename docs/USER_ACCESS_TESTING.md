# Prueba local · usuarios, invitaciones y contraseñas

Esta guía valida el circuito completo de acceso de la Etapa 1 sin desplegar el frontend en Render.

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

Si preferís SQL Editor, ejecutar las migraciones pendientes en orden. La gestión de usuarios necesita especialmente:

```text
supabase/migrations/20260909170000_user_access_management.sql
```

## 3. Publicar la Edge Function de invitación

La invitación usa `auth.admin.inviteUserByEmail`, por lo que debe ejecutarse del lado servidor. La `service_role` nunca se coloca en `.env` del frontend.

```bash
npx supabase functions deploy invite-user
```

Supabase provee `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` automáticamente a la función alojada.

## 4. Autorizar la URL local para correos

En Supabase ir a **Authentication → URL Configuration → Redirect URLs** y agregar:

```text
http://localhost:3000/set-password
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

## 6. Caso admin

1. Iniciar sesión con el administrador actual.
2. Confirmar que aparece **Usuarios** en el menú lateral.
3. Entrar a `/users`.
4. Verificar que la cuenta propia aparece como `Administrador` y `Activo`.
5. La propia cuenta no debe permitir cambio de rol ni desactivación desde la UI.

## 7. Invitación completa

Usar un correo de prueba al que tengas acceso.

1. En **Usuarios**, pulsar **Invitar usuario**.
2. Completar nombre, correo y rol `Miembro`.
3. Confirmar que aparece el mensaje de invitación enviada.
4. Abrir el correo recibido en una ventana incógnito o en otro navegador.
5. El enlace debe abrir `/set-password`.
6. Crear una contraseña de 8 o más caracteres.
7. Debe entrar al Dashboard de SF Higiene.
8. En esa cuenta no debe aparecer **Usuarios** en el menú.
9. Escribir manualmente `http://localhost:3000/users`: debe redirigir a `/dashboard`.

## 8. Roles y permisos documentales

Con dos navegadores o sesiones separadas:

### Miembro

- Puede ver documentos de su empresa.
- Puede crear documentos.
- Si creó un documento o quedó asignado como responsable, puede editarlo y avanzar su estado.
- En documentos ajenos donde no es responsable, no debe ver **Editar** ni el botón de avance de estado.
- Solo puede eliminar un documento propio mientras siga en `Borrador`.

### Responsable

Desde la cuenta admin, cambiar el usuario de prueba a `Responsable`. Recargar la otra sesión.

- No debe aparecer **Usuarios**.
- Debe poder editar y avanzar cualquier documento de la empresa.
- No debe aparecer eliminar para documentos ajenos, porque la política de borrado sigue reservada al admin o al creador de un borrador.

### Administrador

- Ve y administra usuarios.
- Puede editar/avanzar cualquier documento.
- Puede eliminar documentos según la política administrativa.

## 9. Desactivar y reactivar

1. Desde admin, desactivar la cuenta de prueba.
2. En la sesión de prueba, recargar la página.
3. Debe aparecer la pantalla de acceso pendiente/sin membresía activa.
4. Los accesos a datos quedan bloqueados por RLS aunque la sesión de Auth todavía exista.
5. Reactivar desde admin.
6. Recargar la sesión de prueba y confirmar que vuelve a entrar.

La base de datos impide dejar a la empresa sin ningún administrador activo.

## 10. Recuperación de contraseña

1. Cerrar sesión con la cuenta de prueba.
2. En Login, pulsar **¿Olvidaste tu contraseña?**.
3. Escribir el correo y enviar.
4. Abrir el correo recibido.
5. Debe volver a `/set-password`.
6. Guardar una contraseña nueva.
7. Confirmar que la contraseña anterior deja de funcionar y la nueva inicia sesión correctamente.

## 11. Tests automáticos

```bash
npm run test:run
npm run build
```

Ambos deben terminar sin errores. GitHub Actions ejecuta las mismas verificaciones en cada push a `main`.
