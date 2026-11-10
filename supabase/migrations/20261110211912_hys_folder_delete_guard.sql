-- Ejecutar completo en SQL Editor. Requiere las migraciones HyS del 09/11.
-- No borra ni mueve carpetas, documentos o archivos existentes.
begin;
create or replace function public.hys_folder_before_delete()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if exists (
    select 1 from public.hys_records r
    where r.company_id = old.company_id
      and r.unit_id is not distinct from old.unit_id and r.section = old.section
      and (r.category = old.category or starts_with(r.category, old.category || ' / '))
  ) or exists (
    select 1 from public.hys_folders f
    where f.company_id = old.company_id
      and f.unit_id is not distinct from old.unit_id and f.section = old.section
      and f.id <> old.id
      and (f.parent_category = old.category or starts_with(f.category, old.category || ' / '))
  ) then
    raise exception 'La carpeta contiene documentos o subcarpetas. Movelos primero para no perder información';
  end if;
  return old;
end;
$$;
drop trigger if exists hys_folders_delete_guard on public.hys_folders;
create trigger hys_folders_delete_guard before delete on public.hys_folders
for each row execute function public.hys_folder_before_delete();
revoke all on function public.hys_folder_before_delete() from public, anon;
revoke all on public.hys_folders from public, anon;
notify pgrst, 'reload schema';
commit;
