begin;

create table if not exists public.work_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_date date not null default current_date,
  location text not null check (length(trim(location)) between 2 and 160),
  description text check (description is null or length(trim(description)) <= 2000),
  hours numeric(6,2) not null check (hours > 0 and hours <= 24),
  cost numeric(14,2) not null default 0 check (cost >= 0),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_entry_activity (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  work_entry_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  entry_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists work_entries_company_date_idx
  on public.work_entries(company_id, work_date desc, created_at desc);
create index if not exists work_entries_created_by_idx
  on public.work_entries(created_by, work_date desc);
create index if not exists work_entry_activity_company_created_idx
  on public.work_entry_activity(company_id, created_at desc);
create index if not exists work_entry_activity_entry_idx
  on public.work_entry_activity(work_entry_id, created_at desc);

create or replace function public.prepare_work_entry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.location := trim(new.location);
  new.description := nullif(trim(coalesce(new.description, '')), '');

  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'not_authenticated';
    end if;
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  else
    if new.company_id is distinct from old.company_id then
      raise exception 'work_entry_company_is_immutable';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'work_entry_creator_is_immutable';
    end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists work_entries_prepare on public.work_entries;
create trigger work_entries_prepare
before insert or update on public.work_entries
for each row execute function public.prepare_work_entry();

create or replace function public.audit_work_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.work_entries%rowtype;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_row := old;
    v_action := 'deleted';
  elsif tg_op = 'INSERT' then
    v_row := new;
    v_action := 'created';
  else
    v_row := new;
    v_action := 'updated';
  end if;

  insert into public.work_entry_activity (
    company_id,
    work_entry_id,
    actor_id,
    action,
    entry_snapshot
  ) values (
    v_row.company_id,
    v_row.id,
    auth.uid(),
    v_action,
    to_jsonb(v_row)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists work_entries_audit on public.work_entries;
create trigger work_entries_audit
after insert or update or delete on public.work_entries
for each row execute function public.audit_work_entry();

alter table public.work_entries enable row level security;
alter table public.work_entry_activity enable row level security;

drop policy if exists work_entries_select_company_member on public.work_entries;
create policy work_entries_select_company_member
on public.work_entries for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists work_entries_insert_company_member on public.work_entries;
create policy work_entries_insert_company_member
on public.work_entries for insert
to authenticated
with check (
  public.is_company_member(company_id)
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists work_entries_update_owner_or_manager on public.work_entries;
create policy work_entries_update_owner_or_manager
on public.work_entries for update
to authenticated
using (
  public.is_company_member(company_id)
  and (
    created_by = auth.uid()
    or public.has_company_role(
      company_id,
      array['admin'::public.company_role, 'responsible'::public.company_role]
    )
  )
)
with check (
  public.is_company_member(company_id)
  and (
    created_by = auth.uid()
    or public.has_company_role(
      company_id,
      array['admin'::public.company_role, 'responsible'::public.company_role]
    )
  )
);

drop policy if exists work_entries_delete_owner_or_manager on public.work_entries;
create policy work_entries_delete_owner_or_manager
on public.work_entries for delete
to authenticated
using (
  public.is_company_member(company_id)
  and (
    created_by = auth.uid()
    or public.has_company_role(
      company_id,
      array['admin'::public.company_role, 'responsible'::public.company_role]
    )
  )
);

drop policy if exists work_entry_activity_select_company_member on public.work_entry_activity;
create policy work_entry_activity_select_company_member
on public.work_entry_activity for select
to authenticated
using (public.is_company_member(company_id));

revoke all on table public.work_entry_activity from public, anon, authenticated;
grant select on public.work_entry_activity to authenticated;

grant select, insert, update, delete on public.work_entries to authenticated;

revoke all on function public.audit_work_entry() from public, anon, authenticated;

commit;
