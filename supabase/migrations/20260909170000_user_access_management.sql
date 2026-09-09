begin;

alter table public.company_members
  add column if not exists is_active boolean not null default true;

create index if not exists company_members_company_active_idx
  on public.company_members(company_id, is_active, role);

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
        and cm.is_active = true
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
        and cm.is_active = true
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
        and mine.is_active = true
        and theirs.user_id = p_other_user_id
    );
$$;

create or replace function public.protect_last_company_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if old.role = 'admin'
       and old.is_active = true
       and (new.role <> 'admin' or new.is_active = false)
       and not exists (
         select 1
         from public.company_members cm
         where cm.company_id = old.company_id
           and cm.user_id <> old.user_id
           and cm.role = 'admin'
           and cm.is_active = true
       ) then
      raise exception 'last_active_admin_required';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'admin'
       and old.is_active = true
       and not exists (
         select 1
         from public.company_members cm
         where cm.company_id = old.company_id
           and cm.user_id <> old.user_id
           and cm.role = 'admin'
           and cm.is_active = true
       ) then
      raise exception 'last_active_admin_required';
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists company_members_protect_last_admin_update on public.company_members;
create trigger company_members_protect_last_admin_update
before update of role, is_active on public.company_members
for each row execute function public.protect_last_company_admin();

drop trigger if exists company_members_protect_last_admin_delete on public.company_members;
create trigger company_members_protect_last_admin_delete
before delete on public.company_members
for each row execute function public.protect_last_company_admin();

commit;
