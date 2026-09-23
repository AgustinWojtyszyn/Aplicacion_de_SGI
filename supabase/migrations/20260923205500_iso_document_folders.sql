begin;

create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requirement_id uuid not null references public.sgi_requirements(id) on delete cascade,
  parent_id uuid references public.document_folders(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_folders_company_requirement_idx
  on public.document_folders(company_id, requirement_id, parent_id);

create unique index if not exists document_folders_unique_name_idx
  on public.document_folders(
    company_id,
    requirement_id,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

alter table public.documents
  add column if not exists folder_id uuid references public.document_folders(id) on delete set null;

create index if not exists documents_folder_idx
  on public.documents(folder_id);

drop trigger if exists document_folders_set_updated_at on public.document_folders;
create trigger document_folders_set_updated_at
before update on public.document_folders
for each row execute function public.set_updated_at();

create or replace function public.validate_document_folder_parent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'folder_company_is_immutable';
    end if;
    if new.requirement_id is distinct from old.requirement_id then
      raise exception 'folder_requirement_is_immutable';
    end if;
  end if;

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'folder_cannot_parent_itself';
    end if;

    if not exists (
      select 1
      from public.document_folders parent
      where parent.id = new.parent_id
        and parent.company_id = new.company_id
        and parent.requirement_id = new.requirement_id
    ) then
      raise exception 'folder_parent_must_share_requirement';
    end if;

    if tg_op = 'UPDATE' and exists (
      with recursive descendants as (
        select child.id
        from public.document_folders child
        where child.parent_id = new.id
        union all
        select child.id
        from public.document_folders child
        join descendants d on child.parent_id = d.id
      )
      select 1 from descendants where id = new.parent_id
    ) then
      raise exception 'folder_cycle_not_allowed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists document_folders_validate_parent on public.document_folders;
create trigger document_folders_validate_parent
before insert or update on public.document_folders
for each row execute function public.validate_document_folder_parent();

create or replace function public.validate_document_sgi_links()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.requirement_id is not null and not exists (
    select 1 from public.sgi_requirements r
    where r.id = new.requirement_id
      and r.company_id = new.company_id
      and r.is_active
  ) then
    raise exception 'requirement_must_belong_to_company';
  end if;

  if new.folder_id is not null then
    if new.requirement_id is null then
      raise exception 'folder_requires_requirement';
    end if;

    if not exists (
      select 1
      from public.document_folders f
      where f.id = new.folder_id
        and f.company_id = new.company_id
        and f.requirement_id = new.requirement_id
    ) then
      raise exception 'folder_must_belong_to_document_requirement';
    end if;
  end if;

  if new.reviewer_id is not null and not public.is_company_member(new.company_id, new.reviewer_id) then
    raise exception 'reviewer_must_belong_to_company';
  end if;

  if new.approver_id is not null and not public.is_company_member(new.company_id, new.approver_id) then
    raise exception 'approver_must_belong_to_company';
  end if;

  return new;
end;
$$;

drop trigger if exists documents_validate_sgi_links on public.documents;
create trigger documents_validate_sgi_links
before insert or update of requirement_id, folder_id, reviewer_id, approver_id on public.documents
for each row execute function public.validate_document_sgi_links();

alter table public.document_folders enable row level security;

drop policy if exists document_folders_select_member on public.document_folders;
create policy document_folders_select_member
on public.document_folders for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists document_folders_insert_member on public.document_folders;
create policy document_folders_insert_member
on public.document_folders for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_company_member(company_id)
);

drop policy if exists document_folders_update_authorized on public.document_folders;
create policy document_folders_update_authorized
on public.document_folders for update
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

drop policy if exists document_folders_delete_authorized on public.document_folders;
create policy document_folders_delete_authorized
on public.document_folders for delete
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

grant select, insert, update, delete on public.document_folders to authenticated;

notify pgrst, 'reload schema';

commit;
