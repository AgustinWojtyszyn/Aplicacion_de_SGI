begin;

-- Login company discovery must not depend on having a responsible/admin user.
-- Newly created workspaces are valid login targets even with zero memberships.
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
  order by lower(c.name), c.created_at;
$$;

create or replace function public.get_login_company(
  p_slug text
)
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
    and lower(c.slug) = lower(trim(coalesce(p_slug, '')))
  limit 1;
$$;

revoke all on function public.list_login_companies() from public;
revoke all on function public.get_login_company(text) from public;

grant execute on function public.list_login_companies() to anon, authenticated;
grant execute on function public.get_login_company(text) to anon, authenticated;

commit;
