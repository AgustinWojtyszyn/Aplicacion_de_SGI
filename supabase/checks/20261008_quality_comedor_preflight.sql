-- SOLO LECTURA · verificar que la revisión 01 quedó instalada.
-- Ejecutar en Supabase SQL Editor de gestiQa DESPUÉS de aplicar la migración.
select 'controles_revision_01' as verificacion, count(*)::text as resultado
from public.quality_checklist_items where revision=1
union all
select 'sitios', count(*)::text from public.quality_sites
union all
select 'inspecciones', count(*)::text from public.quality_inspections
union all
select 'respuestas', count(*)::text from public.quality_inspection_answers
union all
select 'hallazgos_pendientes', count(*)::text from public.quality_inspection_answers
where followup_status in ('open','in_progress')
union all
select 'bucket_evidencias_privado', case when exists (
  select 1 from storage.buckets where id='quality-evidence' and public=false
) then 'SI' else 'NO' end;

-- Verificación de Laura: el correo identifica su cuenta; no otorga permisos.
-- Si no aparece, la cuenta aún no está registrada en esta instancia de Supabase.
select
  p.email,
  p.full_name,
  c.name as empresa,
  cm.role::text as rol,
  cm.is_active as acceso_activo,
  public.is_platform_admin(p.id) as administrador_global,
  case
    when cm.is_active is distinct from true then 'SIN PERMISO ACTIVO'
    when cm.role in ('admin','responsible') then 'EDITA BORRADORES DE LA EMPRESA'
    when cm.role='member' then 'EDITA BORRADORES PROPIOS O ASIGNADOS'
    else 'SIN PERMISO DOCUMENTAL'
  end as alcance_documental
from public.profiles p
left join public.company_members cm on cm.user_id=p.id
left join public.companies c on c.id=cm.company_id
where lower(p.email)='laugimenez25@yahoo.com.ar'
order by c.name;

-- Resumen de inspecciones y porcentaje de controles conformes (N/A excluidos).
select c.name as empresa, s.name as establecimiento,
  i.inspection_number, i.inspection_date, i.inspector_name, i.status,
  count(a.id) as respuestas,
  count(a.id) filter (where a.result='complies') as conformes,
  count(a.id) filter (where a.result='non_complies') as no_conformes,
  count(a.id) filter (where a.result='partial') as parciales,
  count(a.id) filter (where a.result='na') as no_aplica,
  round(100.0 * count(a.id) filter (where a.result='complies') /
    nullif(count(a.id) filter (where a.result<>'na'),0), 2) as porcentaje_cumplimiento
from public.quality_inspections i
join public.quality_sites s on s.id=i.site_id and s.company_id=i.company_id
join public.companies c on c.id=i.company_id
left join public.quality_inspection_answers a on a.inspection_id=i.id
group by c.name, s.name, i.inspection_number, i.inspection_date, i.inspector_name, i.status
order by i.inspection_date desc, i.inspection_number desc
limit 100;
