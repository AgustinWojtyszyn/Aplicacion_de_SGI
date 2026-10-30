-- Eliminación definitiva explícita de empresas, con bitácora de limpieza de Storage.
-- La empresa y sus datos relacionales se eliminan en una transacción.
-- Los archivos físicos se eliminan con la Storage API mediante una Edge Function
-- y quedan registrados para reintentos si falla la conexión.
begin;

create table if not exists public.company_purge_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  company_name text not null,
  company_slug text not null,
  requested_by uuid not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  last_error text
);

create table if not exists public.company_purge_objects (
  job_id uuid not null references public.company_purge_jobs(id) on delete cascade,
  object_path text not null,
  primary key (job_id, object_path)
);

create index if not exists company_purge_jobs_pending_idx
  on public.company_purge_jobs(created_at) where finished_at is null;

alter table public.company_purge_jobs enable row level security;
alter table public.company_purge_objects enable row level security;

revoke all on public.company_purge_jobs, public.company_purge_objects from public, anon, authenticated;
grant select, insert, update, delete on public.company_purge_jobs, public.company_purge_objects to service_role;

-- El viejo RPC ya no debe eliminar espacios sin registrar la limpieza física.
revoke all on function public.delete_company_workspace(uuid) from public, anon, authenticated;

create or replace function public.purge_company_workspace(
  p_company_id uuid,
  p_expected_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company record;
  v_job_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'not_authorized';
  end if;
  if p_company_id is null or p_expected_name is null then
    raise exception 'invalid_company';
  end if;

  select c.id, c.name, c.slug into v_company
  from public.companies c
  where c.id = p_company_id
  for update;

  if not found then
    raise exception 'company_not_found';
  end if;
  if v_company.slug = 'ep-consultora' then
    raise exception 'system_company_cannot_be_deleted';
  end if;
  if v_company.name is distinct from p_expected_name then
    raise exception 'company_name_mismatch';
  end if;

  insert into public.company_purge_jobs
    (company_id, company_name, company_slug, requested_by)
  values
    (v_company.id, v_company.name, v_company.slug, auth.uid())
  returning id into v_job_id;

  -- Solo lectura de Storage. Los binarios se borran mediante la API oficial,
  -- NUNCA con DELETE sobre storage.objects.
  insert into public.company_purge_objects (job_id, object_path)
  select v_job_id, o.name
  from storage.objects o
  where o.bucket_id = 'sgi-documents'
    and o.name like p_company_id::text || '/%'
  on conflict do nothing;

  -- FKs ON DELETE CASCADE borran documentos/versiones, carpetas, normas,
  -- historiales, trabajos y membresías DE ESTA EMPRESA, no auth.users.
  delete from public.companies where id = p_company_id;
  return v_job_id;
end;
$function$;

revoke all on function public.purge_company_workspace(uuid, text) from public, anon, authenticated;
grant execute on function public.purge_company_workspace(uuid, text) to authenticated;

-- Permite reanudar una limpieza incompleta e incluir objetos rezagados.
create or replace function public.refresh_company_purge_objects(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_inserted integer;
begin
  select j.company_id into v_company_id
  from public.company_purge_jobs j
  where j.id = p_job_id and j.finished_at is null
  for update;

  if not found then
    raise exception 'purge_job_not_found';
  end if;

  insert into public.company_purge_objects (job_id, object_path)
  select p_job_id, o.name
  from storage.objects o
  where o.bucket_id = 'sgi-documents'
    and o.name like v_company_id::text || '/%'
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$function$;

revoke all on function public.refresh_company_purge_objects(uuid) from public, anon, authenticated;
grant execute on function public.refresh_company_purge_objects(uuid) to service_role;

-- Prohibir que se suban nuevos archivos a identificadores de empresas inexistentes.
-- Sustituir las dos políticas permisivas previas (Postgres combina políticas con OR).
drop policy if exists sgi_documents_insert_members on storage.objects;
drop policy if exists documents_insert_storage_member on storage.objects;
create policy sgi_documents_insert_members
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'sgi-documents'
  and exists (
    select 1 from public.companies c
    where c.id = public.safe_storage_company_id(name)
      and c.is_active = true
  )
  and public.is_company_member(public.safe_storage_company_id(name))
);

notify pgrst, 'reload schema';
commit;
