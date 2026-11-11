-- GESTIQA / Higiene y Seguridad: habilitar material multimedia para capacitación.
-- Ejecutar manualmente en el Supabase correcto. No modifica RLS, documentos, ni empresas.
begin;

do $check$
begin
  if not exists (
    select 1 from storage.buckets where id = 'hys-files' and public = false
  ) then
    raise exception 'No existe el bucket privado hys-files. Verificá el proyecto y las migraciones previas.';
  end if;
end
$check$;

update storage.buckets
set file_size_limit = greatest(coalesce(file_size_limit, 0), 52428800),
    allowed_mime_types = case
      when allowed_mime_types is null then null -- Un bucket sin restricción sigue sin restricción.
      else array(
        select distinct mime
        from unnest(allowed_mime_types || array[
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
          'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
          'application/vnd.oasis.opendocument.presentation',
          'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'
        ]::text[]) as mime
        order by mime
      )
    end
where id = 'hys-files' and public = false;

commit;

-- Comprobación: el bucket debe seguir siendo privado, habilitar MP4/PPTX y permitir 50 MB.
select id, public, file_size_limit / 1048576.0 as limite_mb,
       allowed_mime_types is null or 'video/mp4' = any(allowed_mime_types) as mp4_permitido,
       allowed_mime_types is null or 'application/vnd.openxmlformats-officedocument.presentationml.presentation' = any(allowed_mime_types) as pptx_permitido
from storage.buckets
where id = 'hys-files';
