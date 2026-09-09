# Estado de Etapa 2 · SGI / ISO

## Implementado

- [x] Estructura SGI para ISO 9001, ISO 14001, ISO 45001 y SGI Integrado.
- [x] Capítulos 4 a 10 con requisitos y descripciones iniciales.
- [x] Asociación de documentos a norma, capítulo y requisito.
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
- [x] Dashboard SGI con documentos, cobertura ISO, tiempo promedio de aprobación y alertas.
- [x] Vista SGI por norma y capítulo con porcentaje de cobertura documental aprobada.
- [x] RLS y permisos para requisitos, versiones y notificaciones.

## Pendientes deliberadamente dejados para el cierre

1. **Notificaciones automáticas por correo** para revisión, aprobación, observaciones y vencimientos.
2. **Job programado de recordatorios/vencimientos** que genere avisos sin necesidad de que un usuario abra la aplicación.

El seguimiento de vencidos ya funciona dentro de la app en tiempo real; el punto 2 corresponde únicamente a automatizar su generación periódica.

## Migraciones de Etapa 2

Ejecutar en este orden:

1. `supabase/migrations/20260909213000_stage2_sgi_workflow.sql`
2. `supabase/migrations/20260909214500_stage2_permissions_hardening.sql`
3. `supabase/migrations/20260909215500_stage2_review_lock.sql`

Después de aplicar las migraciones, probar el circuito con al menos dos usuarios distintos: creador/responsable, revisor y aprobador.
