begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.company_role as enum ('admin', 'responsible', 'member');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.document_status as enum ('draft', 'in_progress', 'approved');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.company_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  code text not null check (code ~ '^[A-Z0-9_-]+$'),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  module_id uuid references public.modules(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 160),
  description text,
  document_type text not null default 'Documento' check (length(trim(document_type)) between 1 and 80),
  norm text,
  status public.document_status not null default 'draft',
  responsible_id uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0 and file_size <= 26214400),
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  comment text not null check (length(trim(comment)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.document_activity (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  from_status public.document_status,
  to_status public.document_status,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_members_user_idx on public.company_members(user_id);
create index if not exists modules_company_idx on public.modules(company_id, is_active);
create index if not exists documents_company_status_idx on public.documents(company_id, status);
create index if not exists documents_company_created_idx on public.documents(company_id, created_at desc);
create index if not exists documents_responsible_idx on public.documents(responsible_id, status);
create index if not exists documents_module_idx on public.documents(module_id);
create index if not exists document_comments_document_idx on public.document_comments(document_id, created_at);
create index if not exists document_activity_document_idx on public.document_activity(document_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists modules_set_updated_at on public.modules;
create trigger modules_set_updated_at
before update on public.modules
for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, email)
select
  u.id,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
  u.email
from auth.users u
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);

create or replace function public.is_company_member(
  p_company_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.company_members cm
      where cm.company_id = p_company_id
        and cm.user_id = p_user_id
    );
$$;

create or replace function public.has_company_role(
  p_company_id uuid,
  p_roles public.company_role[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.company_members cm
      where cm.company_id = p_company_id
        and cm.user_id = p_user_id
        and cm.role = any(p_roles)
    );
$$;

create or replace function public.shares_company(
  p_other_user_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.company_members mine
      join public.company_members theirs
        on theirs.company_id = mine.company_id
      where mine.user_id = p_user_id
        and theirs.user_id = p_other_user_id
    );
$$;

create or replace function public.safe_storage_company_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  return nullif(split_part(p_name, '/', 1), '')::uuid;
exception
  when others then return null;
end;
$$;

create or replace function public.prepare_document_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.approved_at = now();
  elsif new.status <> 'approved' then
    new.approved_at = null;
  end if;

  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'document_company_is_immutable';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'document_creator_is_immutable';
    end if;
    if new.file_path is distinct from old.file_path then
      raise exception 'document_file_path_is_immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists documents_prepare_status on public.documents;
create trigger documents_prepare_status
before insert or update on public.documents
for each row execute function public.prepare_document_status();

create or replace function public.log_document_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.document_activity (document_id, actor_id, action, to_status, details)
    values (
      new.id,
      coalesce(auth.uid(), new.created_by),
      'created',
      new.status,
      jsonb_build_object('title', new.title)
    );
  elsif new.status is distinct from old.status then
    insert into public.document_activity (document_id, actor_id, action, from_status, to_status)
    values (new.id, coalesce(auth.uid(), new.created_by), 'status_changed', old.status, new.status);
  elsif new.responsible_id is distinct from old.responsible_id then
    insert into public.document_activity (document_id, actor_id, action, details)
    values (
      new.id,
      coalesce(auth.uid(), new.created_by),
      'responsible_changed',
      jsonb_build_object(
        'from', old.responsible_id,
        'to', new.responsible_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists documents_log_activity on public.documents;
create trigger documents_log_activity
after insert or update on public.documents
for each row execute function public.log_document_activity();

insert into public.companies (name, slug)
values ('EP Consultora', 'ep-consultora')
on conflict (slug) do update set name = excluded.name;

insert into public.modules (company_id, name, code, description)
select c.id, seed.name, seed.code, seed.description
from public.companies c
cross join (
  values
    ('Gestión Documental', 'DOC', 'Documentación general y control documental interno.'),
    ('Calidad', 'CALIDAD', 'Documentación vinculada con calidad y mejora.'),
    ('Ambiente', 'AMBIENTE', 'Documentación vinculada con gestión ambiental.'),
    ('Seguridad y Salud', 'SST', 'Documentación de seguridad y salud en el trabajo.'),
    ('Administración', 'ADMIN', 'Documentación administrativa y de soporte.')
) as seed(name, code, description)
where c.slug = 'ep-consultora'
on conflict (company_id, code) do update
  set name = excluded.name,
      description = excluded.description;

create or replace function public.bootstrap_ep_consultora_admin()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext('ep-consultora-admin-bootstrap')::bigint);

  select id into v_company_id
  from public.companies
  where slug = 'ep-consultora';

  if v_company_id is null then
    raise exception 'ep_consultora_company_missing';
  end if;

  if public.is_company_member(v_company_id, auth.uid()) then
    return true;
  end if;

  if exists (
    select 1
    from public.company_members
    where company_id = v_company_id
  ) then
    return false;
  end if;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, auth.uid(), 'admin')
  on conflict (company_id, user_id) do nothing;

  return true;
end;
$$;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.modules enable row level security;
alter table public.documents enable row level security;
alter table public.document_comments enable row level security;
alter table public.document_activity enable row level security;

drop policy if exists profiles_select_company_peers on public.profiles;
create policy profiles_select_company_peers
on public.profiles for select
to authenticated
using (id = auth.uid() or public.shares_company(id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists companies_select_member on public.companies;
create policy companies_select_member
on public.companies for select
to authenticated
using (public.is_company_member(id));

drop policy if exists company_members_select_company on public.company_members;
create policy company_members_select_company
on public.company_members for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists company_members_insert_admin on public.company_members;
create policy company_members_insert_admin
on public.company_members for insert
to authenticated
with check (
  public.has_company_role(company_id, array['admin'::public.company_role])
);

drop policy if exists company_members_update_admin on public.company_members;
create policy company_members_update_admin
on public.company_members for update
to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]))
with check (public.has_company_role(company_id, array['admin'::public.company_role]));

drop policy if exists company_members_delete_admin on public.company_members;
create policy company_members_delete_admin
on public.company_members for delete
to authenticated
using (
  user_id <> auth.uid()
  and public.has_company_role(company_id, array['admin'::public.company_role])
);

drop policy if exists modules_select_member on public.modules;
create policy modules_select_member
on public.modules for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists modules_insert_admin on public.modules;
create policy modules_insert_admin
on public.modules for insert
to authenticated
with check (public.has_company_role(company_id, array['admin'::public.company_role]));

drop policy if exists modules_update_admin on public.modules;
create policy modules_update_admin
on public.modules for update
to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]))
with check (public.has_company_role(company_id, array['admin'::public.company_role]));

drop policy if exists modules_delete_admin on public.modules;
create policy modules_delete_admin
on public.modules for delete
to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]));

drop policy if exists documents_select_member on public.documents;
create policy documents_select_member
on public.documents for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists documents_insert_member on public.documents;
create policy documents_insert_member
on public.documents for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_company_member(company_id)
);

drop policy if exists documents_update_authorized on public.documents;
create policy documents_update_authorized
on public.documents for update
to authenticated
using (
  public.is_company_member(company_id)
  and (
    created_by = auth.uid()
    or responsible_id = auth.uid()
    or public.has_company_role(
      company_id,
      array['admin'::public.company_role, 'responsible'::public.company_role]
    )
  )
)
with check (public.is_company_member(company_id));

drop policy if exists documents_delete_authorized on public.documents;
create policy documents_delete_authorized
on public.documents for delete
to authenticated
using (
  public.has_company_role(company_id, array['admin'::public.company_role])
  or (created_by = auth.uid() and status = 'draft')
);

drop policy if exists comments_select_member on public.document_comments;
create policy comments_select_member
on public.document_comments for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.is_company_member(d.company_id)
  )
);

drop policy if exists comments_insert_member on public.document_comments;
create policy comments_insert_member
on public.document_comments for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.is_company_member(d.company_id)
  )
);

drop policy if exists activity_select_member on public.document_activity;
create policy activity_select_member
on public.document_activity for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.is_company_member(d.company_id)
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'sgi-documents',
  'sgi-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists sgi_documents_select_members on storage.objects;
create policy sgi_documents_select_members
on storage.objects for select
to authenticated
using (
  bucket_id = 'sgi-documents'
  and public.is_company_member(public.safe_storage_company_id(name))
);

drop policy if exists sgi_documents_insert_members on storage.objects;
create policy sgi_documents_insert_members
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'sgi-documents'
  and public.is_company_member(public.safe_storage_company_id(name))
);

drop policy if exists sgi_documents_update_managers on storage.objects;
create policy sgi_documents_update_managers
on storage.objects for update
to authenticated
using (
  bucket_id = 'sgi-documents'
  and public.has_company_role(
    public.safe_storage_company_id(name),
    array['admin'::public.company_role, 'responsible'::public.company_role]
  )
)
with check (
  bucket_id = 'sgi-documents'
  and public.has_company_role(
    public.safe_storage_company_id(name),
    array['admin'::public.company_role, 'responsible'::public.company_role]
  )
);

drop policy if exists sgi_documents_delete_managers on storage.objects;
create policy sgi_documents_delete_managers
on storage.objects for delete
to authenticated
using (
  bucket_id = 'sgi-documents'
  and public.has_company_role(
    public.safe_storage_company_id(name),
    array['admin'::public.company_role, 'responsible'::public.company_role]
  )
);

grant select, update on public.profiles to authenticated;
grant select on public.companies to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;
grant select, insert, update, delete on public.modules to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert on public.document_comments to authenticated;
grant select on public.document_activity to authenticated;
grant usage, select on sequence public.document_activity_id_seq to authenticated;

grant execute on function public.is_company_member(uuid, uuid) to authenticated;
grant execute on function public.has_company_role(uuid, public.company_role[], uuid) to authenticated;
grant execute on function public.shares_company(uuid, uuid) to authenticated;
grant execute on function public.bootstrap_ep_consultora_admin() to authenticated;

commit;
