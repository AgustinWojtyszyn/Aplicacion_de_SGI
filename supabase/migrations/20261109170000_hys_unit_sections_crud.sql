-- HyS: apartados editables, por empresa y establecimiento.
-- Ejecutar MANUALMENTE luego de 20261109133000_hys_folders_crud.sql.
-- No se borran carpetas, documentos ni permisos.
begin;

create table if not exists public.hys_unit_sections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_id uuid not null,
  code text not null check (
    code in ('legal','visits','art','risks','inspections','reports','emergencies','procedures',
      'training','measurements','contractors','actions','compliance')
    or code ~ '^custom_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  label text not null check (length(btrim(label)) between 2 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, company_id) references public.hys_units(id, company_id) on delete cascade,
  constraint hys_unit_sections_unique unique (company_id, unit_id, code)
);

create or replace function public.hys_unit_section_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.id <> old.id or new.company_id <> old.company_id or new.unit_id <> old.unit_id or new.code <> old.code
  ) then
    raise exception 'No se puede cambiar la empresa, sede o identidad del apartado';
  end if;
  new.label := btrim(new.label);
  if length(new.label) not between 2 and 100 then
    raise exception 'El apartado debe tener entre 2 y 100 caracteres';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists hys_unit_section_guard on public.hys_unit_sections;
create trigger hys_unit_section_guard before insert or update on public.hys_unit_sections
for each row execute function public.hys_unit_section_guard();

alter table public.hys_unit_sections enable row level security;
revoke all on public.hys_unit_sections from public, anon, authenticated;
drop policy if exists hys_unit_sections_read on public.hys_unit_sections;
create policy hys_unit_sections_read on public.hys_unit_sections for select to authenticated
using (public.has_company_role(company_id,array['admin'::public.company_role])
  or public.hys_can(company_id,code,unit_id,false));
drop policy if exists hys_unit_sections_insert on public.hys_unit_sections;
create policy hys_unit_sections_insert on public.hys_unit_sections for insert to authenticated
with check (public.has_company_role(company_id,array['admin'::public.company_role]));
drop policy if exists hys_unit_sections_update on public.hys_unit_sections;
create policy hys_unit_sections_update on public.hys_unit_sections for update to authenticated
using (public.has_company_role(company_id,array['admin'::public.company_role]))
with check (public.has_company_role(company_id,array['admin'::public.company_role]));
-- Ausencia de permiso DELETE: ocultar conserva los documentos y permite deshacer.
grant select,insert,update on public.hys_unit_sections to authenticated;

-- Extender los códigos permitidos sin perder la lista anterior.
alter table public.hys_records drop constraint if exists hys_records_section_check;
alter table public.hys_records add constraint hys_records_section_check
check (section in ('general','legal','visits','art','risks','inspections','reports',
  'emergencies','procedures','training','measurements','contractors','actions','compliance')
  or section ~ '^custom_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
alter table public.hys_folders drop constraint if exists hys_folders_section_check;
alter table public.hys_folders add constraint hys_folders_section_check
check (section in ('general','legal','visits','art','risks','inspections','reports',
  'emergencies','procedures','training','measurements','contractors','actions','compliance')
  or section ~ '^custom_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
alter table public.hys_grants drop constraint if exists hys_grants_section_check;
alter table public.hys_grants add constraint hys_grants_section_check
check (section in ('general','legal','visits','art','risks','inspections','reports',
  'emergencies','procedures','training','measurements','contractors','actions','compliance')
  or section ~ '^custom_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- Los apartados personalizados se deben crear previamente en la misma sede.
create or replace function public.hys_custom_section_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if starts_with(new.section, 'custom_') and (
    new.unit_id is null or not exists (
      select 1 from public.hys_unit_sections s where s.company_id = new.company_id
        and s.unit_id = new.unit_id and s.code = new.section and s.is_active
    )
  ) then raise exception 'Apartado personalizado inexistente o desactivado para este establecimiento';
  end if;
  return new;
end;
$$;
drop trigger if exists hys_record_custom_section_guard on public.hys_records;
create trigger hys_record_custom_section_guard before insert or update on public.hys_records
for each row execute function public.hys_custom_section_guard();
drop trigger if exists hys_folder_custom_section_guard on public.hys_folders;
create trigger hys_folder_custom_section_guard before insert or update on public.hys_folders
for each row execute function public.hys_custom_section_guard();
drop trigger if exists hys_grant_custom_section_guard on public.hys_grants;
create trigger hys_grant_custom_section_guard before insert or update on public.hys_grants
for each row execute function public.hys_custom_section_guard();

notify pgrst, 'reload schema';
commit;
