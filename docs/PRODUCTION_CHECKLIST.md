# Checklist de producción · EP Consultora

Usar esta lista antes de considerar el sistema listo para entrega o deploy final.

## Base de datos

- [ ] Ejecutar las 12 migraciones en orden.
- [ ] Confirmar que existen `sgi_requirements`, `document_versions`, `sgi_notifications` y `platform_admins`.
- [ ] Confirmar que `documents` tiene `requirement_id`, `reviewer_id`, `approver_id`, `review_due_at` y `current_version`.
- [ ] Confirmar que existen empresas y membresías multiempresa.
- [ ] Verificar RLS con un usuario activo y otro pendiente/inactivo.
- [ ] Verificar aislamiento usando usuarios de dos empresas distintas.

## Auth y usuarios

- [ ] Confirmar que `/` muestra la selección de empresa antes del login.
- [ ] Confirmar que el registro público queda asociado a la empresa seleccionada sin exponer documentación.
- [ ] Confirmar que el administrador global puede crear una empresa indicando su primer administrador.
- [ ] Confirmar que la invitación del primer administrador llega y permite establecer contraseña.
- [ ] Confirmar que un administrador de empresa puede gestionar usuarios únicamente de su espacio.
- [ ] Confirmar que solo el administrador global ve y administra **Empresas**.
- [ ] Confirmar que un admin de empresa no es reconocido como administrador global.
- [ ] Confirmar que el administrador global puede cambiar de empresa desde la barra superior.
- [ ] Confirmar que un usuario pendiente ve la pantalla de acceso pendiente.
- [ ] Probar recuperación de contraseña.
- [ ] Probar invitación administrativa mediante `invite-user`.
- [ ] Configurar Site URL y Redirect URLs de Supabase para local y producción.

## Flujo documental

- [ ] Crear un documento nuevo.
- [ ] Asociarlo a norma, capítulo y requisito.
- [ ] Crear una segunda versión.
- [ ] Enviarlo a revisión con revisor y aprobador distintos.
- [ ] Probar devolución con observación obligatoria.
- [ ] Reenviar, revisar y aprobar.
- [ ] Confirmar que el documento aprobado queda bloqueado.
- [ ] Confirmar trazabilidad en actividad e historial de versiones.

## SGI y alertas

- [ ] Verificar cobertura por ISO 9001, 14001, 45001 y SGI Integrado.
- [ ] Verificar capítulos 4 a 10.
- [ ] Confirmar alertas de revisión y aprobación.
- [ ] Confirmar marcado leído/no leído.
- [ ] Probar una fecha de revisión vencida.
- [ ] Verificar métricas del dashboard con datos reales.

## Frontend

- [ ] Revisar selección de empresa, login, recuperación y alta pública con branding EP Consultora.
- [ ] Revisar sidebar, favicon y título del navegador.
- [ ] Verificar que un admin de empresa no vea **Empresas**.
- [ ] Verificar que el cambio de empresa del admin global refresque dashboard, documentos y alertas.
- [ ] Probar en resoluciones de escritorio habituales.
- [ ] Confirmar que no quedan errores en consola.
- [ ] Confirmar que no se muestran nombres de productos o clientes anteriores.

## Calidad

```bash
npm install
npm run test:run
npm run build
```

- [ ] Tests verdes.
- [ ] Build de producción exitoso.
- [ ] GitHub Actions verde sobre `main`.

## Guion mínimo para la reunión

- [ ] Mostrar selector de empresa antes del login.
- [ ] Ingresar como administrador global de EP Consultora.
- [ ] Crear una empresa de prueba y asignar/invitar su primer administrador.
- [ ] Mostrar que el administrador del cliente no puede ver **Empresas**.
- [ ] Cambiar entre dos empresas como administrador global.
- [ ] Mostrar que la documentación cambia con el espacio activo.
- [ ] Crear o abrir un documento y recorrer versión → revisión → aprobación.
- [ ] Mostrar matriz SGI/ISO y dashboard.
- [ ] Mostrar un usuario pendiente y su posterior habilitación.

## Deploy final

- [ ] Crear/configurar el Static Site de Render usando `render.yaml`.
- [ ] Cargar `VITE_SUPABASE_URL`.
- [ ] Cargar `VITE_SUPABASE_ANON_KEY`.
- [ ] No cargar `service_role` en Render para el frontend.
- [ ] Agregar la URL pública a Supabase Auth.
- [ ] Desplegar la Edge Function `invite-user`.
- [ ] Hacer un smoke test completo desde la URL publicada.

## Pendiente funcional deliberado

- [ ] Emails automáticos por eventos del flujo documental distintos de las invitaciones de acceso.

Las alertas internas y los recordatorios de vencimientos ya forman parte del circuito de la aplicación.
