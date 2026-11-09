# Higiene y Seguridad · implementación

Basado en el documento **Esquema funcional – Higiene y Seguridad** recibido el 9/11/2026.

## Qué agrega

- Navegación nueva `/hys` en EP GESTIÓN, sin alterar el SGI/ISO existente.
- Ficha de empresa / cliente con razón social, CUIT (11 dígitos), actividad y ART.
- Establecimientos (sedes, obras o lugares de prestación) por empresa, con domicilio opcional.
- Documentación general de empresa y legajo específico de **13 apartados** por establecimiento.
- Registros con título, subapartado, observaciones, fecha, vencimiento, archivo opcional, versiones y marcado obsoleto.
- Archivos privados en bucket separado `hys-files`, no en `sgi-documents`.
- Plan de acción editable en la web: responsable, prioridad, estado, plazo, descripción, evidencia e historial de cambios.
- Descarga de plan en un archivo Excel compatible (`.xls`, SpreadsheetML).
- Tablero por establecimiento con visitas, acciones, documentos vencidos y vigencia documental de los registros que tengan fecha.
- Permisos de HyS por sección y sede, lectura o edición; la base de datos valida los permisos mediante RLS.
- Modalidad opcional **Usuario exclusivo HyS**: para cuentas `member`, impide acceso al SGI usando el control central `is_company_member`. No altera cuentas existentes salvo cuando un administrador la habilita.

## Activación

1. **No ejecutar SQL automáticamente.** El administrador debe ejecutar, en el Supabase CORRECTO de EP GESTIÓN, la migración `supabase/migrations/20261109100000_hys_module.sql` después de todas las anteriores.
2. Revisar las políticas de `storage.objects` preexistentes. Las políticas permisivas se suman mediante OR; no debe haber otra política que habilite el bucket `hys-files` fuera de `hys_file_allowed`.
3. Entrar como administrador de la empresa, crear una sede y cargar documentación general / registros de cada apartado.
4. Crear un usuario con rol **Usuario** (membresía habilitada). En `Higiene y Seguridad → Permisos específicos` seleccionar esa cuenta, activar *Acceso exclusivo* solo si no debe consultar SGI, y conceder `actions` únicamente en su sede, en lectura o edición.
5. Validar con sesiones separadas de administrador, usuario exclusivo HyS, usuario tradicional y una persona sin permisos.
6. Verificar RLS por consultas directas a REST, archivos de Storage, acceso a otra empresa y revocación de permisos. El hecho de ocultar botones no reemplaza el control de la base.

**Compatibilidad de despliegue:** la consulta de autenticación tiene un fallback para instalaciones que todavía no aplicaron esta migración; en ese caso el módulo HyS mostrará un error de configuración, pero el SGI existente debe seguir funcionando.

## Límites de esta entrega

- La edición en línea es del **plan de acción estructurado**, no de cualquier archivo `.xlsx` existente. Los Word/Excel adjuntos siguen siendo documentos; no hay un editor Office completo incorporado.
- Se puede descargar el plan como Excel compatible. No se reimportan automáticamente fórmulas, macros ni estilos avanzados de libros externos.
- El porcentaje del panel contabiliza solo documentos cargados que tengan vencimiento; no certifica el cumplimiento reglamentario.
- La numeración de ART preserva lo recibido (salta de 03.04 a 03.06); verificar con Melisa si corresponde un apartado 03.05.

## Verificación sugerida

```bash
npm install
npm run test:run
npm run build
```

Probar además un archivo PDF y un Word en las sedes, nueva versión, documento obsoleto, evidencia de una acción, edición concurrente (optimistic locking), acceso exclusivo a una sede y acceso denegado al SGI para un usuario limitado.

No asumir que el código en main aplica migraciones ni que Render o Supabase desplegaron cambios: verificar por separado.
