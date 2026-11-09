-- EP GESTIÓN · Higiene y Seguridad: sedes, legajos, acciones y accesos mínimos.
-- APLICACIÓN MANUAL: ejecutar en el proyecto Supabase del SGI antes de usar /hys.
-- No modifica documentos ISO ni membresías anteriores.
begin;

-- A limited member may use only the explicitly shared HyS sections.
-- Existing company memberships remain unrestricted by default.
alter table public.company_members add column if not exists hys_only boolean not null default false;
alter table public.company_members add constraint hys_only_member_role check (not hys_only or role = 'member');

create or replace function public.is_company_member(
  p_company_id uuid, p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select p_user_id is not null and (
    public.is_platform_admin(p_user_id)
    or (
      p_company_id = (
        select cm.company_id
        from public.company_members cm join public.companies c on c.id = cm.company_id
        where cm.user_id = p_user_id and cm.is_active and c.is_active
        order by cm.joined_at, cm.company_id limit 1
      )
      and exists (
        select 1 from public.company_members cm
        where cm.company_id = p_company_id and cm.user_id = p_user_id
          and cm.is_active and not cm.hys_only
      )
    )
  );
$$;

create function public.hys_is_member(p_company uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_user_id is not null and (
    public.is_platform_admin(p_user_id)
    or p_company = (
      select cm.company_id from public.company_members cm
      join public.companies c on c.id = cm.company_id
      where cm.user_id = p_user_id and cm.is_active and c.is_active
      order by cm.joined_at, cm.company_id limit 1
    )
  );
$$;
revoke all on function public.hys_is_member(uuid,uuid) from public, anon;
grant execute on function public.hys_is_member(uuid,uuid) to authenticated;

-- Restricted members still need to resolve their login company and own membership.
drop policy if exists company_members_select_company on public.company_members;
create policy company_members_select_company on public.company_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_company_member(company_id));
create policy companies_hys_only_self_select on public.companies for select to authenticated
  using (exists (select 1 from public.company_members cm
    where cm.company_id = id and cm.user_id = (select auth.uid())
      and cm.is_active and cm.hys_only));

create table public.hys_company_details (
  company_id uuid primary key references public.companies(id) on delete cascade,
  legal_name text not null default '' check (length(btrim(legal_name)) <= 180),
  cuit text check (cuit is null or cuit ~ '^[0-9]{11}$'),
  activity text not null default '',
  art_provider text not null default '',
  updated_at timestamptz not null default now()
);
create trigger hys_company_details_timestamp before update on public.hys_company_details
  for each row execute function public.set_updated_at();
alter table public.hys_company_details enable row level security;
create policy hys_company_details_read on public.hys_company_details for select to authenticated
  using (public.hys_is_member(company_id));
create policy hys_company_details_add on public.hys_company_details for insert to authenticated
  with check (public.has_company_role(company_id,array['admin'::public.company_role]));
create policy hys_company_details_edit on public.hys_company_details for update to authenticated
  using (public.has_company_role(company_id,array['admin'::public.company_role]))
  with check (public.has_company_role(company_id,array['admin'::public.company_role]));
grant select,insert,update on public.hys_company_details to authenticated;

create table public.hys_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 160),
  kind text not null default 'sede' check (kind in ('sede','obra','prestacion')),
  address text,
  created_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index hys_units_company_name on public.hys_units(company_id, lower(name));

create table public.hys_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid,
  section text not null check (section in ('general','legal','visits','art','risks','inspections','reports','emergencies','procedures','training','measurements','contractors','actions','compliance')),
  permission text not null check (permission in ('read','edit')),
  granted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (unit_id, company_id) references public.hys_units(id, company_id) on delete cascade,
  constraint hys_general_grant_is_company_wide check (section <> 'general' or unit_id is null),
  constraint hys_grant_unique unique nulls not distinct (company_id, user_id, section, unit_id)
);
create index hys_grants_person on public.hys_grants(user_id, company_id);

-- Admins always have full control. Delegates require an active membership plus
-- a named section grant; unit grants never authorize general/company-wide data.
create function public.hys_can(p_company uuid, p_section text, p_unit uuid, p_write boolean default false)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    public.has_company_role(p_company, array['admin'::public.company_role])
    or (
      public.hys_is_member(p_company)
      and exists (
        select 1 from public.hys_grants g
        where g.company_id = p_company and g.user_id = (select auth.uid())
          and g.section = p_section
          and (not p_write or g.permission = 'edit')
          and (g.unit_id is null or (p_unit is not null and g.unit_id = p_unit))
      )
    )
  );
$$;
revoke all on function public.hys_can(uuid,text,uuid,boolean) from public, anon;
grant execute on function public.hys_can(uuid,text,uuid,boolean) to authenticated;

create function public.hys_unit_visible(p_company uuid, p_unit uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.has_company_role(p_company, array['admin'::public.company_role])
    or (
      public.hys_is_member(p_company)
      and exists (
        select 1 from public.hys_grants g
        where g.company_id = p_company and g.user_id = (select auth.uid())
          and g.section <> 'general'
          and (g.unit_id = p_unit or g.unit_id is null)
      )
    );
$$;
revoke all on function public.hys_unit_visible(uuid,uuid) from public, anon;
grant execute on function public.hys_unit_visible(uuid,uuid) to authenticated;

create function public.hys_validate_grant()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.company_members cm
    where cm.company_id = new.company_id and cm.user_id = new.user_id and cm.is_active
  ) and not public.is_platform_admin(new.user_id) then
    raise exception 'Usuario sin membresía activa en esta empresa';
  end if;
  if new.granted_by <> (select auth.uid()) then
    raise exception 'Concedente inválido';
  end if;
  return new;
end;
$$;
create trigger hys_grants_validate before insert or update on public.hys_grants
  for each row execute function public.hys_validate_grant();

create table public.hys_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_id uuid,
  title text not null check (length(btrim(title)) between 3 and 180),
  description text not null default '',
  responsible text not null default '',
  priority text not null default 'media' check (priority in ('baja','media','alta','critica')),
  status text not null default 'pendiente' check (status in ('pendiente','en_curso','resuelta','verificada')),
  due_date date,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, company_id) references public.hys_units(id,company_id) on delete restrict
);
create index hys_actions_lookup on public.hys_actions(company_id, unit_id, status, due_date);

create table public.hys_action_history (
  id bigint generated always as identity primary key,
  action_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_id uuid,
  event text not null check (event in ('created','updated','deleted')),
  actor_id uuid references public.profiles(id) on delete set null,
  details jsonb not null,
  created_at timestamptz not null default now()
);
create index hys_action_history_lookup on public.hys_action_history(company_id, action_id, created_at desc);

create function public.hys_action_before_write()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.company_id <> old.company_id
       or new.unit_id is distinct from old.unit_id
       or new.created_by <> old.created_by or new.created_at <> old.created_at then
      raise exception 'No se puede cambiar la identidad ni el establecimiento de una acción';
    end if;
    new.version := old.version + 1;
    new.updated_at := now();
  else
    if new.version <> 1 then raise exception 'La versión inicial debe ser 1'; end if;
  end if;
  return new;
end;
$$;
create trigger hys_actions_guard before insert or update on public.hys_actions
  for each row execute function public.hys_action_before_write();

create function public.hys_log_action()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.hys_action_history(action_id, company_id, unit_id, event, actor_id, details)
  values (
    coalesce(new.id,old.id),
    coalesce(new.company_id,old.company_id),
    coalesce(new.unit_id,old.unit_id),
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    (select auth.uid()),
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new,old);
end;
$$;
create trigger hys_actions_audit after insert or update or delete on public.hys_actions
  for each row execute function public.hys_log_action();

create table public.hys_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_id uuid,
  section text not null check (section in ('general','legal','visits','art','risks','inspections','reports','emergencies','procedures','training','measurements','contractors','actions','compliance')),
  category text not null default 'Otros' check (length(btrim(category)) between 1 and 160),
  title text not null check (length(btrim(title)) between 2 and 180),
  notes text not null default '',
  recorded_at date,
  expires_at date,
  file_name text,
  file_path text unique,
  file_size bigint check (file_size between 1 and 26214400),
  version_no integer not null default 1 check (version_no > 0),
  supersedes_id uuid references public.hys_records(id) on delete restrict,
  action_id uuid references public.hys_actions(id) on delete set null,
  is_obsolete boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id,company_id) references public.hys_units(id,company_id) on delete restrict,
  constraint hys_records_unit_required check (
    (section = 'general' and unit_id is null)
    or section = 'actions'
    or (section <> 'general' and section <> 'actions' and unit_id is not null)
  ),
  constraint hys_file_fields_consistent check (
    (file_path is null and file_name is null and file_size is null)
    or (file_path is not null and file_name is not null and file_size is not null)
  )
);
create index hys_records_lookup on public.hys_records(company_id,unit_id,section,expires_at);

create function public.hys_validate_record()
returns trigger language plpgsql set search_path = ''
as $$
declare v_prev public.hys_records%rowtype;
begin
  if new.file_path is not null
    and new.file_path not like (new.company_id::text || '/' || new.id::text || '/%')
  then raise exception 'Ruta de archivo inválida'; end if;

  if new.action_id is not null and (
    new.section <> 'actions' or not exists (
      select 1 from public.hys_actions a
      where a.id = new.action_id and a.company_id = new.company_id
        and a.unit_id is not distinct from new.unit_id
    )
  ) then raise exception 'La evidencia no pertenece a esta acción'; end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.company_id <> old.company_id
       or new.unit_id is distinct from old.unit_id or new.section <> old.section
       or new.file_path is distinct from old.file_path
       or new.created_by <> old.created_by or new.version_no <> old.version_no
       or new.supersedes_id is distinct from old.supersedes_id then
      raise exception 'La identidad y el archivo son inmutables; cargá otra versión';
    end if;
    new.updated_at := now();
  elsif new.supersedes_id is not null then
    select * into v_prev from public.hys_records where id = new.supersedes_id;
    if not found or v_prev.company_id <> new.company_id
       or v_prev.unit_id is distinct from new.unit_id
       or v_prev.section <> new.section or new.version_no <> v_prev.version_no + 1 then
      raise exception 'Referencia de versión incompatible';
    end if;
  elsif new.version_no <> 1 then
    raise exception 'La versión inicial debe ser 1';
  end if;
  return new;
end;
$$;
create trigger hys_records_guard before insert or update on public.hys_records
  for each row execute function public.hys_validate_record();

alter table public.hys_units enable row level security;
alter table public.hys_grants enable row level security;
alter table public.hys_actions enable row level security;
alter table public.hys_action_history enable row level security;
alter table public.hys_records enable row level security;

create policy hys_units_read on public.hys_units for select to authenticated
 using (public.hys_unit_visible(company_id,id));
create policy hys_units_add on public.hys_units for insert to authenticated
 with check (public.has_company_role(company_id,array['admin'::public.company_role]));
create policy hys_units_edit on public.hys_units for update to authenticated
 using (public.has_company_role(company_id,array['admin'::public.company_role]))
 with check (public.has_company_role(company_id,array['admin'::public.company_role]));

create policy hys_grants_read on public.hys_grants for select to authenticated
 using (public.has_company_role(company_id,array['admin'::public.company_role])
   or (user_id = (select auth.uid()) and public.hys_is_member(company_id)));
create policy hys_grants_add on public.hys_grants for insert to authenticated
 with check (public.has_company_role(company_id,array['admin'::public.company_role]));
create policy hys_grants_edit on public.hys_grants for update to authenticated
 using (public.has_company_role(company_id,array['admin'::public.company_role]))
 with check (public.has_company_role(company_id,array['admin'::public.company_role]));
create policy hys_grants_del on public.hys_grants for delete to authenticated
 using (public.has_company_role(company_id,array['admin'::public.company_role]));

create policy hys_actions_read on public.hys_actions for select to authenticated
 using (public.hys_can(company_id,'actions',unit_id,false));
create policy hys_actions_add on public.hys_actions for insert to authenticated
 with check (created_by = (select auth.uid()) and version = 1
   and public.hys_can(company_id,'actions',unit_id,true));
create policy hys_actions_edit on public.hys_actions for update to authenticated
 using (public.hys_can(company_id,'actions',unit_id,true))
 with check (public.hys_can(company_id,'actions',unit_id,true));
create policy hys_actions_del on public.hys_actions for delete to authenticated
 using (public.has_company_role(company_id,array['admin'::public.company_role]));

create policy hys_action_history_read on public.hys_action_history for select to authenticated
 using (public.hys_can(company_id,'actions',unit_id,false));

create policy hys_records_read on public.hys_records for select to authenticated
 using (public.hys_can(company_id,section,unit_id,false));
create policy hys_records_add on public.hys_records for insert to authenticated
 with check (created_by = (select auth.uid()) and public.hys_can(company_id,section,unit_id,true));
create policy hys_records_rollback on public.hys_records for delete to authenticated
 using (created_by = (select auth.uid()) and public.hys_can(company_id,section,unit_id,true)
   and created_at > now() - interval '15 minutes');

create policy hys_records_edit on public.hys_records for update to authenticated
 using (public.hys_can(company_id,section,unit_id,true))
 with check (public.hys_can(company_id,section,unit_id,true));

-- The dedicated bucket prevents existing SGI document policies from broadening
-- access. Objects must match a previously authorized record exactly.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('hys-files','hys-files',false,26214400,
  array[
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv','text/plain','image/png','image/jpeg','image/webp'
  ]::text[])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create function public.hys_file_allowed(p_name text, p_write boolean default false)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.hys_records r
    where r.file_path = p_name
      and public.hys_can(r.company_id,r.section,r.unit_id,p_write)
  );
$$;
revoke all on function public.hys_file_allowed(text,boolean) from public, anon;
grant execute on function public.hys_file_allowed(text,boolean) to authenticated;

create policy hys_storage_read on storage.objects for select to authenticated
 using (bucket_id = 'hys-files' and public.hys_file_allowed(name,false));
create policy hys_storage_add on storage.objects for insert to authenticated
 with check (bucket_id = 'hys-files' and public.hys_file_allowed(name,true));

grant select,insert,update on public.hys_units to authenticated;
grant select,insert,update,delete on public.hys_grants to authenticated;
grant select,insert,update,delete on public.hys_actions to authenticated;
grant select on public.hys_action_history to authenticated;
grant select,insert,update,delete on public.hys_records to authenticated;

notify pgrst, 'reload schema';
commit;
