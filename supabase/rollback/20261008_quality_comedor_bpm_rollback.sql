-- REVERSIÓN EXPLÍCITA DE LA MIGRACIÓN 20261008160000_quality_comedor_bpm.sql
-- ⚠ USAR SOLO SI EL MÓDULO TODAVÍA NO TIENE DATOS QUE CONSERVAR.
-- 1) Primero revertí el cambio del frontend en main y esperá el deploy.
-- 2) Si hay datos, NO ejecutes esta limpieza: dejá tablas nuevas intactas
--    hasta exportarlas y decidir cómo preservarlas.
-- 3) Este script aborta si existen establecimientos, auditorías o archivos.
-- No modifica tablas ni documentos anteriores de gestiQa.

begin;

do $$
begin
  if exists (select 1 from public.quality_sites limit 1)
    or exists (select 1 from public.quality_inspections limit 1)
    or exists (select 1 from public.quality_inspection_answers limit 1)
    or exists (select 1 from public.quality_inspection_activity limit 1)
    or exists (select 1 from storage.objects where bucket_id = 'quality-evidence' limit 1)
  then
    raise exception 'rollback_bloqueado: existen datos o evidencias. Revertir solo frontend, exportar/verificar datos antes de limpiar SQL';
  end if;
end
$$;

drop policy if exists quality_evidence_read on storage.objects;
drop policy if exists quality_evidence_upload on storage.objects;

drop table if exists public.quality_inspection_activity;
drop table if exists public.quality_inspection_answers;
drop table if exists public.quality_inspections;
drop table if exists public.quality_checklist_items;
drop table if exists public.quality_sites;

drop function if exists public.quality_log_activity();
drop function if exists public.quality_guard_answer();
drop function if exists public.quality_guard_inspection();
drop function if exists public.quality_guard_site();

delete from storage.buckets where id = 'quality-evidence'
  and not exists (select 1 from storage.objects where bucket_id = 'quality-evidence');

commit;
