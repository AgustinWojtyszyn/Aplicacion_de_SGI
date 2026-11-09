-- EP GESTIÓN | HyS: complemento manual si ya ejecutaste la migración inicial.
-- No vuelve a crear el módulo, no modifica documentos y se puede repetir.
-- Ejecutar únicamente en el proyecto Supabase de EP GESTIÓN.
begin;

do $guard$
begin
  if to_regclass('public.hys_units') is null
     or to_regclass('public.hys_records') is null
     or to_regprocedure('public.hys_is_member(uuid,uuid)') is null
     or to_regprocedure('public.hys_file_allowed(text,boolean)') is null then
    raise exception 'Falta la migración inicial de Higiene y Seguridad. No ejecutar este complemento antes de la migración original.';
  end if;
end;
$guard$;

create table if not exists public.hys_company_details (
  company_id uuid primary key references public.companies(id) on delete cascade,
  legal_name text not null default '' check (length(btrim(legal_name)) <= 180),
  cuit text check (cuit is null or cuit ~ '^[0-9]{11}$'),
  activity text not null default '',
  art_provider text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.hys_company_details
  add column if not exists legal_name text not null default '',
  add column if not exists cuit text,
  add column if not exists activity text not null default '',
  add column if not exists art_provider text not null default '',
  add column if not exists updated_at timestamptz not null default now();

alter table public.hys_units add column if not exists address text;

do $trigger$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.hys_company_details'::regclass
      and tgname = 'hys_company_details_timestamp'
      and not tgisinternal
  ) then
    create trigger hys_company_details_timestamp
      before update on public.hys_company_details
      for each row execute function public.set_updated_at();
  end if;
end;
$trigger$;

alter table public.hys_company_details enable row level security;

drop policy if exists hys_company_details_read on public.hys_company_details;
create policy hys_company_details_read on public.hys_company_details for select to authenticated
  using (public.hys_is_member(company_id));

drop policy if exists hys_company_details_add on public.hys_company_details;
create policy hys_company_details_add on public.hys_company_details for insert to authenticated
  with check (public.has_company_role(company_id,array['admin'::public.company_role]));

drop policy if exists hys_company_details_edit on public.hys_company_details;
create policy hys_company_details_edit on public.hys_company_details for update to authenticated
  using (public.has_company_role(company_id,array['admin'::public.company_role]))
  with check (public.has_company_role(company_id,array['admin'::public.company_role]));

-- Recuperar o verificar el bucket privado si quedó sin configurar.
-- Se reutilizan exactamente las restricciones de la migración inicial.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('hys-files','hys-files',false,26214400,
  array[
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv','text/plain','image/png','image/jpeg','image/webp'
  ]::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hys_storage_read on storage.objects;
create policy hys_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'hys-files' and public.hys_file_allowed(name,false));

drop policy if exists hys_storage_add on storage.objects;
create policy hys_storage_add on storage.objects for insert to authenticated
  with check (bucket_id = 'hys-files' and public.hys_file_allowed(name,true));

grant select,insert,update on public.hys_company_details to authenticated;
notify pgrst, 'reload schema';
commit;

-- Solo inspección: confirmar que el complemento y el bucket inicial existen.
select
  to_regclass('public.hys_company_details') is not null as ficha_empresa_ok,
  to_regclass('public.hys_units') is not null as establecimientos_ok,
  to_regclass('public.hys_records') is not null as documentos_ok,
  exists (select 1 from storage.buckets where id = 'hys-files' and public = false) as bucket_privado_ok,
  exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hys_units' and column_name = 'address') as domicilio_ok;
