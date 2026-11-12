-- Ejecutar manualmente en GESTIQA, después de habilitar carpetas y multimedia.
begin;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'hys-files' and not public) then
    raise exception 'Se requiere el bucket privado hys-files';
  end if;
end;
$$;

-- El límite original de la tabla era menor que el límite de videos del bucket.
alter table public.hys_records drop constraint if exists hys_records_file_size_check;
alter table public.hys_records add constraint hys_records_file_size_check
  check (file_size between 1 and case
    when file_name ~* '\.(mp4|webm|mov|m4v)$' then 52428800 else 26214400 end) not valid;

create table if not exists public.hys_folder_uploads (
  id uuid primary key,
  folder_id uuid not null references public.hys_folders(id) on delete cascade,
  category text not null,
  file_name text not null check (
    length(file_name) between 2 and 255 and file_name = btrim(file_name)
    and file_name !~ '[[:cntrl:]/]' and position(chr(92) in file_name) = 0
    and file_name ~* '\.(pdf|docx?|xlsx?|csv|txt|png|jpe?g|webp|ppt[xm]?|ppsx?|odp|mp4|webm|mov|m4v)$'
  ),
  file_size bigint not null check (file_size between 1 and case
    when file_name ~* '\.(mp4|webm|mov|m4v)$' then 52428800 else 26214400 end),
  file_path text not null unique,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists hys_folder_uploads_folder_idx on public.hys_folder_uploads(folder_id);
alter table public.hys_folder_uploads enable row level security;
revoke all on public.hys_folder_uploads from public, anon, authenticated;
grant select, insert, delete on public.hys_folder_uploads to authenticated;

drop policy if exists hys_folder_uploads_scope on public.hys_folder_uploads;
create policy hys_folder_uploads_scope on public.hys_folder_uploads for all to authenticated
  using (created_by = (select auth.uid()) and exists (
    select 1 from public.hys_folders f where f.id = folder_id
      and public.hys_can(f.company_id, f.section, f.unit_id, true)
  ))
  with check (created_by = (select auth.uid()) and exists (
    select 1 from public.hys_folders f where f.id = folder_id and f.category = hys_folder_uploads.category
      and file_path = f.company_id::text || '/' || hys_folder_uploads.id::text || '/archivo'
      and public.hys_can(f.company_id, f.section, f.unit_id, true)
  ));

-- Las políticas de carga individual siguen vigentes. Una reserva solo habilita
-- el objeto exacto para su autor mientras conserve permiso de edición.
drop policy if exists hys_folder_upload_storage_insert on storage.objects;
create policy hys_folder_upload_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'hys-files' and exists (
    select 1 from public.hys_folder_uploads p join public.hys_folders f on f.id = p.folder_id
      where p.file_path = storage.objects.name and f.category = p.category
  ));
drop policy if exists hys_folder_upload_storage_select on storage.objects;
create policy hys_folder_upload_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'hys-files' and exists (
    select 1 from public.hys_folder_uploads p where p.file_path = storage.objects.name
  ));

create or replace function public.hys_finish_folder_upload(p_id uuid, p_folder uuid, p_category text, p_name text, p_size bigint)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare
  folder public.hys_folders%rowtype;
  pending public.hys_folder_uploads%rowtype;
begin
  select * into folder from public.hys_folders where id = p_folder for update;
  if not found or folder.category is distinct from p_category
    or not public.hys_can(folder.company_id, folder.section, folder.unit_id, true) then
    raise exception 'La carpeta cambió o no tenés permiso para escribir en ella.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.hys_records r where r.id = p_id and r.created_by = (select auth.uid())
      and r.company_id = folder.company_id and r.unit_id is not distinct from folder.unit_id
      and r.section = folder.section and r.category = folder.category
      and r.file_name = p_name and r.file_size = p_size
  ) then
    delete from public.hys_folder_uploads where id = p_id and folder_id = p_folder;
    return true;
  end if;
  select * into pending from public.hys_folder_uploads where id = p_id and folder_id = p_folder;
  if not found or pending.category is distinct from p_category or pending.file_name is distinct from p_name or pending.file_size is distinct from p_size then
    raise exception 'La reserva del archivo no está disponible.';
  end if;
  if exists (
    select 1 from public.hys_records r
      where r.company_id = folder.company_id and r.unit_id is not distinct from folder.unit_id
        and r.section = folder.section and r.category = folder.category
        and lower(r.file_name) = lower(pending.file_name)
  ) then
    raise exception 'Ya existe un archivo con ese nombre en la carpeta.' using errcode = '23505';
  end if;
  if not exists (
    select 1 from storage.objects o
      where o.bucket_id = 'hys-files' and o.name = pending.file_path
        and o.metadata->>'size' = pending.file_size::text
  ) then
    return false;
  end if;
  insert into public.hys_records (id, company_id, unit_id, section, category, title,
    file_name, file_size, file_path, created_by)
  values (pending.id, folder.company_id, folder.unit_id, folder.section, folder.category,
    left(pending.file_name, 180), pending.file_name, pending.file_size, pending.file_path, pending.created_by);
  delete from public.hys_folder_uploads where id = pending.id;
  return true;
end;
$$;

revoke all on function public.hys_finish_folder_upload(uuid,uuid,text,text,bigint) from public, anon;
grant execute on function public.hys_finish_folder_upload(uuid,uuid,text,text,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
