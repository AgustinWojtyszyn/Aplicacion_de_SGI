# IntegraFlow · Estado funcional SGI / ISO

## Implementado

- [x] Identidad de producto IntegraFlow independiente del cliente/sector.
- [x] Registro público con habilitación administrativa antes de acceder a información interna.
- [x] Estructura SGI para ISO 9001, ISO 14001, ISO 45001 y SGI Integrado.
- [x] Capítulos 4 a 10 con requisitos y descripciones iniciales.
- [x] Asociación de documentos a norma, capítulo y requisito.
- [x] Navegación directa desde cada norma/capítulo hacia sus documentos filtrados.
- [x] Control formal de versiones de archivos.
- [x] Versión inicial automática y nuevas versiones numeradas.
- [x] Registro de autor y comentario por versión.
- [x] Flujo Borrador → Revisión → Aprobado.
- [x] Revisor y aprobador designados.
- [x] Registro de revisión, aprobación y devolución con observaciones.
- [x] Bloqueo de contenido mientras el documento está en revisión y una vez aprobado.
- [x] Trazabilidad en historial de actividad.
- [x] Fecha objetivo de revisión.
- [x] Alertas internas por revisión, aprobación y cambios solicitados.
- [x] Vista de documentos vencidos.
- [x] Centro de alertas con estado leído/no leído.
- [x] Recordatorios automáticos de revisión próxima a vencer y vencida.
- [x] Job diario de vencimientos mediante Supabase Cron / pg_cron cuando está disponible.
- [x] Dashboard SGI con documentos, cobertura ISO, tiempo promedio de aprobación y alertas.
- [x] KPI de documentos con observaciones en revisión.
- [x] KPI de aprobaciones dentro del plazo objetivo.
- [x] KPI de respuesta de revisores y aprobadores.
- [x] KPI de versiones promedio antes de aprobación.
- [x] KPI de alertas atendidas.
- [x] Visual de flujo por estado documental.
- [x] Ranking de cumplimiento por ISO 9001, ISO 14001, ISO 45001 y SGI Integrado.
- [x] Semáforo operativo de tiempo de aprobación.
- [x] Vista SGI por norma y capítulo con porcentaje de cobertura documental aprobada.
- [x] RLS y permisos para requisitos, versiones y notificaciones.
- [x] Branding, favicon, metadata web y configuración de deploy actualizados a IntegraFlow.

## Pendiente para el cierre final

1. **Notificaciones automáticas por correo** para revisión, aprobación, observaciones y vencimientos.

Las notificaciones dentro de IntegraFlow ya funcionan y los recordatorios de vencimientos se generan en base de datos sin necesidad de abrir la aplicación. El correo queda como canal externo adicional.

## Migraciones actuales

Ejecutar en orden:

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

### Cron de vencimientos

La última migración intenta habilitar `pg_cron` y programa `public.generate_sgi_due_notifications()` todos los días a las `12:00 UTC` (09:00 de Argentina UTC-3).

Si el proyecto no permite habilitar `pg_cron` por SQL, la migración conserva la función y deja un `NOTICE`; en ese caso se debe programar la misma función desde **Supabase → Cron** con frecuencia diaria.

## Smoke test recomendado antes de la reunión

Probar al menos con tres cuentas o roles distintos:

- creador/responsable;
- revisor;
- aprobador/admin.

Validar registro público, habilitación de usuario, carga de documento, clasificación ISO, navegación por capítulo, nueva versión, envío a revisión, devolución con observaciones, revisión, aprobación, KPIs, alertas y bloqueo posterior.
