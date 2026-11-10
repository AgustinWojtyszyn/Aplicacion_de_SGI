# Auditoría de carpetas HyS — 10/11/2026

## Causa reproducida

`hysConfiguredSections` sobrescribía únicamente el título del apartado fijo y conservaba sus categorías. Al renombrar `legal` (01) a «Material de capacitación», heredaba «Documentación legal» y «Organización preventiva». `renderRecords` materializaba esas categorías como tarjetas incluso sin registros. No eran inserciones automáticas de carpetas en Supabase. Los apartados `custom_*` recibían además una categoría «Otros» inventada.

El caso fue reproducido con datos locales equivalentes al reporte. No se consultaron los registros reales de Melisa ni se ejecutó SQL remoto.

## Matriz y conservación

Fuente contrastada: `EP_Gestion_.docx`, Esquema funcional – Higiene y Seguridad, páginas 1–3, recibido el 09/11. Los 13 apartados tienen respectivamente 1, 1, 9, 4, 1, 3, 1, 2, 8, 8, 1, 1 y 8 contenidos (48 en total). Se eliminó la expansión artificial de textos agrupados y la carpeta vacía «Evidencias». La documentación general vuelve a sus seis carpetas originales; la antigua matriz general numerada solo se ofrece cuando contiene información guardada.

Un apartado con nombre diferente al original conserva su código, permisos, carpetas y documentos, pero deja de recibir categorías automáticas. No se infiere otra plantilla a partir del nuevo título. Restituir exactamente el título original recupera las categorías de la matriz. Los nuevos apartados personalizados empiezan sin carpetas.

Las rutas antiguas que contienen documentos o son padres de carpetas guardadas siguen accesibles. No se renombraron, fusionaron, movieron ni borraron datos reales. Una categoría histórica puede seguir visible si contiene información: ocultarla por su nombre pondría en riesgo el acceso a documentos.

## Aislamiento y CRUD

- Consultas de carga: filtro explícito `company_id`, paginación y orden estable.
- Configuración, navegación y destinos de carpetas: empresa, sede y apartado.
- Validación de nombres reservados: utiliza el catálogo efectivo de la sede, igual que la navegación.
- Respuestas de cargas anteriores se descartan si hubo una actualización posterior o desmontaje.
- CRUD existente conservado: Crear carpeta, Editar / mover, Eliminar. Eliminar carpetas ocupadas está bloqueado.
- Revisión de migraciones: FK compuesta sede/empresa; identidad inmutable de carpetas; RLS mediante `hys_can`; permisos específicos de apartado y sede; RPC de carpetas `SECURITY INVOKER`; renombrado transaccional de rutas y documentos.
- Hallazgo adicional: DELETE directo podía omitir la comprobación de contenido del RPC. El SQL nuevo añade esa comprobación mediante trigger y revoca privilegios de `PUBLIC`/`anon` sobre la tabla. No cambia políticas de otros módulos.

## Evidencia local

- Suite completa: 98/98 tests antes de agregar el recorrido exhaustivo final.
- Suite final de interfaz HyS: 7/7; incluye CRUD, documentos históricos, regresión de Melisa y navegación por los 13 apartados / 48 contenidos, comprobando ausencia de carpetas de otros apartados.
- Catálogo: 15 tests, incluidos renombrados de los 13 apartados y aislamiento de empresa/sede.
- PostgreSQL local con PGlite: CRUD, conservación de documento en subcarpeta al renombrar padre, protección de borrado RPC y directo, aislamiento de empresa/sede/apartado, roles lectura/edición/inactivo/anónimo, FK compuesta e idempotencia del SQL. Usa migraciones reales de carpetas y apartados y `hys_can`; tablas de identidad y documentos de prueba reducidas. No equivale a un Supabase completo.
- `npm run build`: correcto. Advertencia de bundles >500 kB; no se modificaron dependencias ni módulos externos al alcance.
- `git diff --check`: correcto.

Reproducción SQL local: instalar `@electric-sql/pglite` en un directorio temporal y ejecutar `HYS_PGLITE_MODULE=/ruta/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-hys-folders-db.mjs`.

## Activación pendiente

Ejecutar manualmente el único archivo `supabase/migrations/20261110211912_hys_folder_delete_guard.sql`, después de las migraciones HyS del 09/11. No se aplicó automáticamente.

No se hizo deploy manual. No se verificaron políticas adicionales, Storage, concurrencia entre transacciones ni datos de la instalación productiva. La interfaz se probó con React Testing Library / jsdom, no con una sesión real de Melisa. El defecto reportado queda corregido y reproduciblemente probado en local; el cierre en producción requiere aplicar el SQL, disponer del frontend actualizado y comprobar el caso con su sesión.
