begin;

alter table public.companies
  add column if not exists is_active boolean not null default true;

create index if not exists companies_active_name_idx
  on public.companies(is_active, name);

-- A platform administrator is any active company administrator. This preserves
-- the existing admin role while allowing administrators to supervise every
-- company workspace from the same account.
create or replace function public.is_platform_admin(
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
      where cm.user_id = p_user_id
        and cm.role = 'admin'
        and cm.is_active = true
    );
$$;

-- Normal users remain restricted to active memberships. Administrators are
-- intentionally allowed through any company-scoped RLS policy so they can
-- inspect and manage all workspaces.
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
    and (
      public.is_platform_admin(p_user_id)
      or exists (
        select 1
        from public.company_members cm
        where cm.company_id = p_company_id
          and cm.user_id = p_user_id
          and cm.is_active = true
      )
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
    and (
      ('admin'::public.company_role = any(p_roles) and public.is_platform_admin(p_user_id))
      or exists (
        select 1
        from public.company_members cm
        where cm.company_id = p_company_id
          and cm.user_id = p_user_id
          and cm.is_active = true
          and cm.role = any(p_roles)
      )
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
    and (
      public.is_platform_admin(p_user_id)
      or exists (
        select 1
        from public.company_members mine
        join public.company_members theirs
          on theirs.company_id = mine.company_id
        where mine.user_id = p_user_id
          and mine.is_active = true
          and theirs.user_id = p_other_user_id
      )
    );
$$;

-- Safe, minimal company directory exposed before authentication. No internal
-- data, users or documents are returned by this function.
create or replace function public.list_login_companies()
returns table (
  id uuid,
  name text,
  slug text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.name, c.slug
  from public.companies c
  where c.is_active = true
  order by c.name;
$$;

-- Public signups are attached as pending members to the company selected in
-- the pre-login flow. They still receive no company data until an admin
-- activates the membership.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_company_slug text;
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

  v_company_slug := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_slug', '')), '');

  if v_company_slug is not null then
    select c.id
      into v_company_id
    from public.companies c
    where c.slug = v_company_slug
      and c.is_active = true
    limit 1;

    if v_company_id is not null then
      insert into public.company_members (company_id, user_id, role, is_active)
      values (v_company_id, new.id, 'member', false)
      on conflict (company_id, user_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- Platform admins can create another isolated workspace. The operational
-- modules and SGI requirement catalogue are copied from the original template
-- so a new company is immediately usable without sharing any documents.
create or replace function public.create_company_workspace(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_template_company_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_platform_admin(auth.uid()) then
    raise exception 'not_authorized';
  end if;

  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'invalid_company_name';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid_company_slug';
  end if;

  insert into public.companies (name, slug, is_active)
  values (v_name, v_slug, true)
  returning id into v_company_id;

  select c.id into v_template_company_id
  from public.companies c
  where c.slug = 'sf-higiene'
  limit 1;

  if v_template_company_id is not null then
    insert into public.modules (company_id, name, code, description, is_active)
    select v_company_id, m.name, m.code, m.description, m.is_active
    from public.modules m
    where m.company_id = v_template_company_id
    on conflict (company_id, code) do nothing;

    insert into public.sgi_requirements (company_id, norm, chapter, code, title, description, is_active)
    select v_company_id, r.norm, r.chapter, r.code, r.title, r.description, r.is_active
    from public.sgi_requirements r
    where r.company_id = v_template_company_id
    on conflict (company_id, norm, code) do nothing;
  end if;

  return v_company_id;
exception
  when unique_violation then
    raise exception 'company_slug_already_exists';
end;
$$;

-- Notifications were originally user-scoped. Administrators also need a
-- complete audit view while operating another company workspace.
drop policy if exists sgi_notifications_platform_admin_select on public.sgi_notifications;
create policy sgi_notifications_platform_admin_select
on public.sgi_notifications for select
to authenticated
using (public.is_platform_admin(auth.uid()));

drop policy if exists sgi_notifications_platform_admin_update on public.sgi_notifications;
create policy sgi_notifications_platform_admin_update
on public.sgi_notifications for update
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

revoke all on function public.list_login_companies() from public;
grant execute on function public.list_login_companies() to anon, authenticated;
grant execute on function public.is_platform_admin(uuid) to authenticated;
grant execute on function public.create_company_workspace(text, text) to authenticated;

commit;
