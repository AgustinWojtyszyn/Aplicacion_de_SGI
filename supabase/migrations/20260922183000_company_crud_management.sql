begin;

create or replace function public.list_managed_companies()
returns table (
  id uuid,
  name text,
  slug text,
  is_active boolean,
  created_at timestamptz,
  member_count bigint,
  admin_count bigint,
  document_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_platform_admin(auth.uid()) then
    raise exception 'not_authorized';
  end if;

  return query
  select
    c.id,
    c.name,
    c.slug,
    c.is_active,
    c.created_at,
    (select count(*) from public.company_members cm where cm.company_id = c.id and cm.is_active = true)::bigint,
    (select count(*) from public.company_members cm where cm.company_id = c.id and cm.is_active = true and cm.role = 'admin')::bigint,
    (select count(*) from public.documents d where d.company_id = c.id)::bigint
  from public.companies c
  order by c.is_active desc, lower(c.name), c.created_at;
end;
$$;

create or replace function public.update_company_workspace(
  p_company_id uuid,
  p_name text,
  p_slug text
)
returns table (
  id uuid,
  name text,
  slug text,
  is_active boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_current_slug text;
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

  select c.slug into v_current_slug
  from public.companies c
  where c.id = p_company_id
  for update;

  if v_current_slug is null then
    raise exception 'company_not_found';
  end if;

  if v_current_slug = 'ep-consultora' and v_slug <> 'ep-consultora' then
    raise exception 'system_company_slug_locked';
  end if;

  update public.companies c
  set name = v_name,
      slug = v_slug
  where c.id = p_company_id;

  return query
  select c.id, c.name, c.slug, c.is_active
  from public.companies c
  where c.id = p_company_id;
exception
  when unique_violation then
    raise exception 'company_slug_already_exists';
end;
$$;

create or replace function public.set_company_active(
  p_company_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_platform_admin(auth.uid()) then
    raise exception 'not_authorized';
  end if;

  select c.slug into v_slug
  from public.companies c
  where c.id = p_company_id
  for update;

  if v_slug is null then
    raise exception 'company_not_found';
  end if;

  if v_slug = 'ep-consultora' and p_is_active = false then
    raise exception 'system_company_cannot_be_archived';
  end if;

  update public.companies
  set is_active = p_is_active
  where id = p_company_id;
end;
$$;

create or replace function public.delete_company_workspace(
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $
declare
  v_slug text;
  v_is_active boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_platform_admin(auth.uid()) then
    raise exception 'not_authorized';
  end if;

  select c.slug, c.is_active
    into v_slug, v_is_active
  from public.companies c
  where c.id = p_company_id
  for update;

  if v_slug is null then
    raise exception 'company_not_found';
  end if;

  if v_slug = 'ep-consultora' then
    raise exception 'system_company_cannot_be_deleted';
  end if;

  if v_is_active then
    raise exception 'company_must_be_archived_before_delete';
  end if;

  delete from public.companies
  where id = p_company_id;
end;
$;

revoke all on function public.list_managed_companies() from public;
revoke all on function public.update_company_workspace(uuid, text, text) from public;
revoke all on function public.set_company_active(uuid, boolean) from public;
revoke all on function public.delete_company_workspace(uuid) from public;

grant execute on function public.list_managed_companies() to authenticated;
grant execute on function public.update_company_workspace(uuid, text, text) to authenticated;
grant execute on function public.set_company_active(uuid, boolean) to authenticated;
grant execute on function public.delete_company_workspace(uuid) to authenticated;

commit;
