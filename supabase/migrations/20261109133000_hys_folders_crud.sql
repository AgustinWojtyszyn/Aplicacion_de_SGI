-- HyS: carpetas personalizadas y subcarpetas persistentes.
-- Aplicación manual: ejecutar UNA VEZ en el SQL Editor del proyecto SGI.
-- No modifica ni elimina documentos existentes.

create table if not exists public.hys_folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_id uuid,
  section text not null check (section in (
    'general','legal','visits','art','risks','inspections','reports',
    'emergencies','procedures','training','measurements','contractors','actions','compliance'
  )),
  parent_category text,
  name text not null check (length(btrim(name)) between 1 and 90),
  category text not null check (length(btrim(category)) between 1 and 160),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id,company_id) references public.hys_units(id,company_id) on delete cascade,
  constraint hys_folders_scope check ((section = 'general' and unit_id is null)
    or (section <> 'general' and unit_id is not null))
);
create unique index if not exists hys_folders_unique_path
  on public.hys_folders(company_id, section, coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(category));
create index if not exists hys_folders_parent_lookup
  on public.hys_folders(company_id, section, unit_id, parent_category);

create or replace function public.hys_folder_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.id <> old.id or new.company_id <> old.company_id
    or new.unit_id is distinct from old.unit_id or new.section <> old.section
    or new.created_by <> old.created_by
  ) then
    raise exception 'No se puede cambiar la empresa, sede o apartado de una carpeta';
  end if;
  new.name := btrim(new.name);
  if position('/' in new.name) > 0 or position(chr(92) in new.name) > 0 then
    raise exception 'El nombre no puede contener barras';
  end if;
  if length(new.name) not between 1 and 90 then
    raise exception 'El nombre de la carpeta debe tener entre 1 y 90 caracteres';
  end if;
  if new.parent_category = '' then new.parent_category := null; end if;
  new.category := case
    when new.parent_category is null then new.name
    when new.parent_category ~ '^[0-9]{2} / $' then new.parent_category || new.name
    else new.parent_category || ' / ' || new.name
  end;
  if length(new.category) > 160 then
    raise exception 'La ruta de la carpeta supera los 160 caracteres';
  end if;
  if new.parent_category = new.category then
    raise exception 'Una carpeta no puede contenerse a sí misma';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists hys_folders_guard on public.hys_folders;
create trigger hys_folders_guard before insert or update on public.hys_folders
for each row execute function public.hys_folder_guard();

alter table public.hys_folders enable row level security;
drop policy if exists hys_folders_read on public.hys_folders;
create policy hys_folders_read on public.hys_folders for select to authenticated
  using (public.hys_can(company_id,section,unit_id,false));
drop policy if exists hys_folders_add on public.hys_folders;
create policy hys_folders_add on public.hys_folders for insert to authenticated
  with check (created_by = (select auth.uid()) and public.hys_can(company_id,section,unit_id,true));
drop policy if exists hys_folders_edit on public.hys_folders;
create policy hys_folders_edit on public.hys_folders for update to authenticated
  using (public.hys_can(company_id,section,unit_id,true))
  with check (public.hys_can(company_id,section,unit_id,true));
drop policy if exists hys_folders_delete on public.hys_folders;
create policy hys_folders_delete on public.hys_folders for delete to authenticated
  using (public.hys_can(company_id,section,unit_id,true));
grant select,insert,update,delete on public.hys_folders to authenticated;

-- Todas las modificaciones son transaccionales y respetan RLS (SECURITY INVOKER).
create or replace function public.hys_create_folder(
  p_company uuid, p_unit uuid, p_section text, p_parent_category text, p_name text
) returns public.hys_folders language plpgsql security invoker set search_path = ''
as $$
declare v_folder public.hys_folders; v_category text;
begin
  if not public.hys_can(p_company,p_section,p_unit,true) then
    raise exception 'No tenés permiso para crear carpetas aquí';
  end if;
  if p_parent_category is not null and length(p_parent_category) > 160 then
    raise exception 'Carpeta padre inválida';
  end if;
  v_category := case
    when nullif(p_parent_category,'') is null then btrim(p_name)
    when p_parent_category ~ '^[0-9]{2} / $' then p_parent_category || btrim(p_name)
    else p_parent_category || ' / ' || btrim(p_name)
  end;
  if exists (
    select 1 from public.hys_records r
    where r.company_id = p_company and r.unit_id is not distinct from p_unit
      and r.section = p_section and lower(r.category) = lower(v_category)
  ) then
    raise exception 'Ya existe un subapartado con registros y ese nombre';
  end if;
  insert into public.hys_folders (company_id,unit_id,section,parent_category,name,category,created_by)
  values (p_company,p_unit,p_section,p_parent_category,p_name,v_category,(select auth.uid()))
  returning * into v_folder;
  return v_folder;
end;
$$;

create or replace function public.hys_update_folder(
  p_id uuid, p_parent_category text, p_name text
) returns public.hys_folders language plpgsql security invoker set search_path = ''
as $$
declare v_old public.hys_folders; v_new public.hys_folders; v_target text;
begin
  select * into v_old from public.hys_folders where id = p_id for update;
  if not found then raise exception 'No se encontró la carpeta'; end if;
  if not public.hys_can(v_old.company_id,v_old.section,v_old.unit_id,true) then
    raise exception 'No tenés permiso para editar esta carpeta';
  end if;
  if length(btrim(p_name)) not between 1 and 90 then
    raise exception 'El nombre debe tener entre 1 y 90 caracteres';
  end if;
  if p_parent_category = v_old.category
    or starts_with(coalesce(p_parent_category,''), v_old.category || ' / ') then
    raise exception 'No podés mover una carpeta dentro de sí misma';
  end if;
  v_target := case
    when nullif(p_parent_category,'') is null then btrim(p_name)
    when p_parent_category ~ '^[0-9]{2} / $' then p_parent_category || btrim(p_name)
    else p_parent_category || ' / ' || btrim(p_name)
  end;
  if length(v_target) > 160 then raise exception 'La ruta supera los 160 caracteres'; end if;
  if v_target <> v_old.category then
    -- No mezclar una carpeta movida con categorías históricas existentes.
    if exists (
      with moved as (
        select r.category from public.hys_records r
        where r.company_id = v_old.company_id and r.unit_id is not distinct from v_old.unit_id
          and r.section = v_old.section
          and (r.category = v_old.category or starts_with(r.category, v_old.category || ' / '))
        union
        select f.category from public.hys_folders f
        where f.company_id = v_old.company_id and f.unit_id is not distinct from v_old.unit_id
          and f.section = v_old.section
          and (f.category = v_old.category or starts_with(f.category, v_old.category || ' / '))
      )
      select 1 from moved m
      join public.hys_records existing
        on lower(existing.category) = lower(v_target || substring(m.category from length(v_old.category) + 1))
      where existing.company_id = v_old.company_id
        and existing.unit_id is not distinct from v_old.unit_id
        and existing.section = v_old.section
        and existing.category <> v_old.category
        and not starts_with(existing.category, v_old.category || ' / ')
    ) then
      raise exception 'La carpeta de destino contiene registros con esos nombres. Elegí otra ubicación';
    end if;
    if exists (
      select 1 from public.hys_folders f
      where f.company_id = v_old.company_id
        and f.unit_id is not distinct from v_old.unit_id
        and f.section = v_old.section and lower(f.category) = lower(v_target)
        and f.id <> v_old.id
    ) then raise exception 'Ya existe una carpeta con ese nombre en la ubicación seleccionada'; end if;
    if exists (
      select 1 from public.hys_folders f
      where f.company_id = v_old.company_id and f.unit_id is not distinct from v_old.unit_id
        and f.section = v_old.section
        and starts_with(f.category, v_old.category || ' / ')
        and length(v_target) + length(f.category) - length(v_old.category) > 160
    ) or exists (
      select 1 from public.hys_records r
      where r.company_id = v_old.company_id and r.unit_id is not distinct from v_old.unit_id
        and r.section = v_old.section
        and starts_with(r.category, v_old.category || ' / ')
        and length(v_target) + length(r.category) - length(v_old.category) > 160
    ) then raise exception 'Una subcarpeta o documento supera el largo máximo de ruta'; end if;
    -- Se actualizan todas las versiones de registros y las subcarpetas, sin tocar archivos en Storage.
    update public.hys_records r
      set category = v_target || substring(r.category from length(v_old.category) + 1)
      where r.company_id = v_old.company_id and r.unit_id is not distinct from v_old.unit_id
        and r.section = v_old.section
        and (r.category = v_old.category or starts_with(r.category, v_old.category || ' / '));
    update public.hys_folders f
      set parent_category = v_target || substring(f.parent_category from length(v_old.category) + 1)
      where f.company_id = v_old.company_id and f.unit_id is not distinct from v_old.unit_id
        and f.section = v_old.section
        and starts_with(coalesce(f.parent_category,''), v_old.category || ' / ');
    update public.hys_folders f
      set parent_category = v_target
      where f.company_id = v_old.company_id and f.unit_id is not distinct from v_old.unit_id
        and f.section = v_old.section and f.parent_category = v_old.category;
  end if;
  update public.hys_folders set name = p_name, parent_category = p_parent_category
    where id = p_id returning * into v_new;
  return v_new;
end;
$$;

create or replace function public.hys_delete_folder(p_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
declare v_old public.hys_folders;
begin
  select * into v_old from public.hys_folders where id = p_id for update;
  if not found then raise exception 'No se encontró la carpeta'; end if;
  if not public.hys_can(v_old.company_id,v_old.section,v_old.unit_id,true) then
    raise exception 'No tenés permiso para eliminar esta carpeta';
  end if;
  if exists (
    select 1 from public.hys_records r
    where r.company_id = v_old.company_id and r.unit_id is not distinct from v_old.unit_id
      and r.section = v_old.section
      and (r.category = v_old.category or starts_with(r.category, v_old.category || ' / '))
  ) or exists (
    select 1 from public.hys_folders f
    where f.company_id = v_old.company_id and f.unit_id is not distinct from v_old.unit_id
      and f.section = v_old.section and f.id <> v_old.id
      and (f.parent_category = v_old.category or starts_with(coalesce(f.category,''), v_old.category || ' / '))
  ) then
    raise exception 'La carpeta contiene documentos o subcarpetas. Movelos primero para no perder información';
  end if;
  delete from public.hys_folders where id = p_id;
end;
$$;
revoke all on function public.hys_create_folder(uuid,uuid,text,text,text) from public,anon;
revoke all on function public.hys_update_folder(uuid,text,text) from public,anon;
revoke all on function public.hys_delete_folder(uuid) from public,anon;
grant execute on function public.hys_create_folder(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.hys_update_folder(uuid,text,text) to authenticated;
grant execute on function public.hys_delete_folder(uuid) to authenticated;
