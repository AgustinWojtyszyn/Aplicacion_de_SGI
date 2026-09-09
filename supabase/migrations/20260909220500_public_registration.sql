begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
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

  select id
    into v_company_id
  from public.companies
  where slug = 'sf-higiene'
  limit 1;

  -- Once SF Higiene already has members, every public signup is registered
  -- as a pending member. This keeps registration public without exposing
  -- internal company data before an administrator enables access.
  if v_company_id is not null
     and exists (
       select 1
       from public.company_members cm
       where cm.company_id = v_company_id
     ) then
    insert into public.company_members (company_id, user_id, role, is_active)
    values (v_company_id, new.id, 'member', false)
    on conflict (company_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Backfill authenticated users that currently have no SF Higiene membership.
insert into public.company_members (company_id, user_id, role, is_active)
select c.id, p.id, 'member'::public.company_role, false
from public.companies c
cross join public.profiles p
where c.slug = 'sf-higiene'
  and exists (
    select 1
    from public.company_members existing
    where existing.company_id = c.id
  )
  and not exists (
    select 1
    from public.company_members cm
    where cm.company_id = c.id
      and cm.user_id = p.id
  )
on conflict (company_id, user_id) do nothing;

commit;
