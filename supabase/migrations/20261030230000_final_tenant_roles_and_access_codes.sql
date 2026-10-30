-- gestiQa: tenant-safe document roles and short company access codes.
-- Apply once to the SGI Supabase project BEFORE deploying the matching frontend.
-- All changes are additive/restrictive; no users or documents are deleted.
begin;

-- Preserve historical company slugs and URLs, but accept four short access codes.
create or replace function public.get_login_company(p_slug text)
returns table (id uuid, name text, slug text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.id, c.name, c.slug
  from public.companies c
  where c.is_active = true
    and c.slug = coalesce(
      (
        select codes.slug
        from (values
          ('andes', 'andes-calingasta-srl'),
          ('gestiqa', 'ep-consultora'),
          ('ingetec', 'ingetec'),
          ('cutral', 'parque-fotovoltaico-cutral-co')
        ) as codes(code, slug)
        where codes.code = lower(trim(coalesce(p_slug, '')))
      ),
      lower(trim(coalesce(p_slug, '')))
    )
  limit 1;
$$;
revoke all on function public.get_login_company(text) from public, anon, authenticated;
grant execute on function public.get_login_company(text) to anon, authenticated;

-- Reserved short codes must never be allocated to a different canonical company.
create or replace function public.guard_company_access_codes()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  if (new.slug in ('andes', 'gestiqa', 'cutral')) then
    raise exception 'reserved_company_access_code';
  end if;
  return new;
end;
$$;
drop trigger if exists companies_guard_access_codes on public.companies;
create trigger companies_guard_access_codes
before insert or update of slug on public.companies
for each row execute function public.guard_company_access_codes();

-- Existing users with old multi-company memberships keep their records. For
-- non-platform admins, only their first active company is accessible.
-- This avoids destructive cleanup while preventing cross-tenant disclosure.
create or replace function public.is_company_member(
  p_company_id uuid, p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null and (
    public.is_platform_admin(p_user_id)
    or p_company_id = (
      select cm.company_id
      from public.company_members cm
      join public.companies c on c.id = cm.company_id
      where cm.user_id = p_user_id
        and cm.is_active = true and c.is_active = true
      order by cm.joined_at asc, cm.company_id asc
      limit 1
    )
  );
$$;

create or replace function public.has_company_role(
  p_company_id uuid, p_roles public.company_role[],
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null
    and public.is_company_member(p_company_id, p_user_id)
    and (
      ('admin'::public.company_role = any(p_roles) and public.is_platform_admin(p_user_id))
      or exists (
        select 1 from public.company_members cm
        where cm.company_id = p_company_id and cm.user_id = p_user_id
          and cm.is_active = true and cm.role = any(p_roles)
      )
    );
$$;

create or replace function public.shares_company(
  p_other_user_id uuid, p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null and (
    public.is_platform_admin(p_user_id)
    or exists (
      select 1 from public.company_members mine
      where mine.user_id = p_user_id and mine.is_active = true
        and public.is_company_member(mine.company_id, p_user_id)
        and public.is_company_member(mine.company_id, p_other_user_id)
    )
  );
$$;

-- Never give a non-global account two active tenant memberships.
create or replace function public.guard_single_company_membership()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- Serialize concurrent assignments for the same user across organizations.
  perform 1 from public.profiles where id = new.user_id for update;
  if new.is_active and not public.is_platform_admin(new.user_id)
     and exists (
       select 1 from public.company_members cm
       join public.companies c on c.id = cm.company_id
       where cm.user_id = new.user_id and cm.company_id <> new.company_id
         and cm.is_active and c.is_active
     )
  then
    raise exception 'user_already_assigned_to_another_company';
  end if;
  return new;
end;
$$;
drop trigger if exists company_members_single_active_company on public.company_members;
create trigger company_members_single_active_company
before insert or update of company_id, user_id, is_active on public.company_members
for each row execute function public.guard_single_company_membership();

-- Document authoring and the underlying files: admins ONLY.
drop policy if exists documents_insert_member on public.documents;
create policy documents_insert_member on public.documents
for insert to authenticated
with check (created_by = (select auth.uid())
  and public.has_company_role(company_id, array['admin'::public.company_role]));

drop policy if exists documents_update_authorized on public.documents;
create policy documents_update_authorized on public.documents
for update to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]))
with check (public.has_company_role(company_id, array['admin'::public.company_role]));

drop policy if exists documents_delete_authorized on public.documents;
create policy documents_delete_authorized on public.documents
for delete to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]));

drop policy if exists comments_insert_member on public.document_comments;
create policy comments_insert_member on public.document_comments
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.documents d where d.id = document_id
      and (
        public.has_company_role(d.company_id, array['admin'::public.company_role])
        or (
          public.has_company_role(d.company_id, array['responsible'::public.company_role])
          and (d.reviewer_id = auth.uid() or d.approver_id = auth.uid())
        )
      )
  )
);

drop policy if exists document_folders_insert_member on public.document_folders;
create policy document_folders_insert_member on public.document_folders
for insert to authenticated with check (
  created_by = auth.uid()
  and public.has_company_role(company_id, array['admin'::public.company_role])
);
drop policy if exists document_folders_update_authorized on public.document_folders;
create policy document_folders_update_authorized on public.document_folders
for update to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]))
with check (public.has_company_role(company_id, array['admin'::public.company_role]));
drop policy if exists document_folders_delete_authorized on public.document_folders;
create policy document_folders_delete_authorized on public.document_folders
for delete to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]));

-- Work entries and ISO evaluation are administrative, not reviewer actions.
drop policy if exists work_entries_select_company_member on public.work_entries;
create policy work_entries_select_company_member on public.work_entries
for select to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]));
drop policy if exists work_entries_insert_company_member on public.work_entries;
create policy work_entries_insert_company_member on public.work_entries
for insert to authenticated
with check (created_by = auth.uid()
  and public.has_company_role(company_id, array['admin'::public.company_role]));
drop policy if exists work_entries_update_owner_or_manager on public.work_entries;
create policy work_entries_update_owner_or_manager on public.work_entries
for update to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]))
with check (public.has_company_role(company_id, array['admin'::public.company_role]));
drop policy if exists work_entries_delete_owner_or_manager on public.work_entries;
create policy work_entries_delete_owner_or_manager on public.work_entries
for delete to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]));
drop policy if exists work_entry_activity_select_company_member on public.work_entry_activity;
create policy work_entry_activity_select_company_member on public.work_entry_activity
for select to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]));
drop policy if exists sgi_evaluations_create_authorized on public.sgi_requirement_evaluations;
create policy sgi_evaluations_create_authorized on public.sgi_requirement_evaluations
for insert to authenticated
with check (evaluated_by = auth.uid()
  and public.has_company_role(company_id, array['admin'::public.company_role]));
drop policy if exists sgi_evaluations_update_authorized on public.sgi_requirement_evaluations;
create policy sgi_evaluations_update_authorized on public.sgi_requirement_evaluations
for update to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]))
with check (public.has_company_role(company_id, array['admin'::public.company_role]));

-- Signed Storage URLs are deliberately ADMIN-ONLY; the preview edge function
-- provides authenticated inline rendering to readers and reviewers instead.
drop policy if exists sgi_documents_select_members on storage.objects;
drop policy if exists sgi_documents_insert_members on storage.objects;
drop policy if exists sgi_documents_update_managers on storage.objects;
drop policy if exists sgi_documents_delete_managers on storage.objects;
drop policy if exists documents_insert_storage_member on storage.objects;
drop policy if exists sgi_documents_select_admin on storage.objects;
drop policy if exists sgi_documents_insert_admin on storage.objects;
drop policy if exists sgi_documents_update_admin on storage.objects;
drop policy if exists sgi_documents_delete_admin on storage.objects;
create policy sgi_documents_select_admin on storage.objects for select
to authenticated using (
  bucket_id = 'sgi-documents'
  and public.has_company_role(public.safe_storage_company_id(name),
    array['admin'::public.company_role])
);
create policy sgi_documents_insert_admin on storage.objects for insert
to authenticated with check (
  bucket_id = 'sgi-documents'
  and public.has_company_role(public.safe_storage_company_id(name),
    array['admin'::public.company_role])
);
create policy sgi_documents_update_admin on storage.objects for update
to authenticated using (
  bucket_id = 'sgi-documents'
  and public.has_company_role(public.safe_storage_company_id(name),
    array['admin'::public.company_role])
) with check (
  bucket_id = 'sgi-documents'
  and public.has_company_role(public.safe_storage_company_id(name),
    array['admin'::public.company_role])
);
create policy sgi_documents_delete_admin on storage.objects for delete
to authenticated using (
  bucket_id = 'sgi-documents'
  and public.has_company_role(public.safe_storage_company_id(name),
    array['admin'::public.company_role])
);

-- Security-definer RPCs bypass table RLS; they MUST enforce role checks.
create or replace function public.create_document_version(
  p_document_id uuid, p_file_name text, p_file_path text,
  p_mime_type text, p_file_size bigint, p_comment text default null
)
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_document public.documents%rowtype; v_version integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if not public.has_company_role(v_document.company_id, array['admin'::public.company_role])
  then raise exception 'not_authorized'; end if;
  if v_document.status = 'approved' then raise exception 'approved_document_is_locked'; end if;
  v_version := v_document.current_version + 1;
  insert into public.document_versions
    (document_id, version_number, file_name, file_path, mime_type, file_size, comment, created_by)
  values (p_document_id, v_version, trim(p_file_name), p_file_path,
    p_mime_type, p_file_size, nullif(trim(coalesce(p_comment, '')), ''), auth.uid());
  update public.documents set current_version = v_version where id = p_document_id;
  insert into public.document_activity (document_id, actor_id, action, details)
  values (p_document_id, auth.uid(), 'version_created',
    jsonb_build_object('version', v_version, 'file_name', p_file_name));
  return v_version;
end;
$$;

create or replace function public.submit_document_for_review(
  p_document_id uuid, p_reviewer_id uuid, p_approver_id uuid,
  p_review_due_at timestamptz default null, p_comment text default null
)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_document public.documents%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if not public.has_company_role(v_document.company_id, array['admin'::public.company_role])
  then raise exception 'not_authorized'; end if;
  if v_document.status <> 'draft' then raise exception 'document_must_be_draft'; end if;
  if not public.has_company_role(v_document.company_id,
    array['admin'::public.company_role, 'responsible'::public.company_role], p_reviewer_id)
  then raise exception 'invalid_reviewer'; end if;
  if not public.has_company_role(v_document.company_id,
    array['admin'::public.company_role, 'responsible'::public.company_role], p_approver_id)
  then raise exception 'invalid_approver'; end if;
  update public.documents set
    status = 'in_progress', reviewer_id = p_reviewer_id,
    approver_id = p_approver_id, review_due_at = p_review_due_at,
    submitted_for_review_at = now(), reviewed_at = null
  where id = p_document_id;
  insert into public.document_activity
    (document_id, actor_id, action, from_status, to_status, details)
  values (p_document_id, auth.uid(), 'submitted_for_review', 'draft', 'in_progress',
    jsonb_build_object('reviewer_id', p_reviewer_id, 'approver_id', p_approver_id,
      'comment', nullif(trim(coalesce(p_comment, '')), '')));
  insert into public.sgi_notifications
    (company_id, user_id, document_id, kind, title, message)
  values (v_document.company_id, p_reviewer_id, p_document_id,
    'review_requested', 'Documento para revisar',
    v_document.title || ' espera tu revisión.');
end;
$$;

create or replace function public.review_document(
  p_document_id uuid, p_comment text default null
)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_document public.documents%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if not public.has_company_role(v_document.company_id,
       array['admin'::public.company_role, 'responsible'::public.company_role])
     or (not public.has_company_role(v_document.company_id,
       array['admin'::public.company_role]) and v_document.reviewer_id is distinct from auth.uid())
  then raise exception 'not_designated_reviewer'; end if;
  if v_document.status <> 'in_progress' then raise exception 'document_not_in_review'; end if;
  if v_document.reviewed_at is not null then raise exception 'already_reviewed'; end if;
  update public.documents set reviewed_at = now() where id = p_document_id;
  insert into public.document_activity (document_id, actor_id, action, details)
  values (p_document_id, auth.uid(), 'reviewed',
    jsonb_build_object('comment', nullif(trim(coalesce(p_comment, '')), '')));
  if v_document.approver_id is not null then
    insert into public.sgi_notifications (company_id, user_id, document_id, kind, title, message)
    values (v_document.company_id, v_document.approver_id, p_document_id,
      'approval_requested', 'Documento listo para aprobar',
      v_document.title || ' fue revisado y espera aprobación.');
  end if;
end;
$$;

create or replace function public.reject_document(p_document_id uuid, p_comment text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_document public.documents%rowtype; v_target uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if nullif(trim(coalesce(p_comment, '')), '') is null
  then raise exception 'rejection_comment_required'; end if;
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if not public.has_company_role(v_document.company_id,
       array['admin'::public.company_role, 'responsible'::public.company_role])
     or (not public.has_company_role(v_document.company_id,
       array['admin'::public.company_role])
       and v_document.reviewer_id is distinct from auth.uid()
       and v_document.approver_id is distinct from auth.uid())
  then raise exception 'not_authorized'; end if;
  if v_document.status <> 'in_progress' then raise exception 'document_not_in_review'; end if;
  update public.documents
  set status = 'draft', reviewed_at = null, submitted_for_review_at = null
  where id = p_document_id;
  insert into public.document_activity
    (document_id, actor_id, action, from_status, to_status, details)
  values (p_document_id, auth.uid(), 'rejected', 'in_progress', 'draft',
    jsonb_build_object('comment', trim(p_comment)));
  v_target := coalesce(v_document.responsible_id, v_document.created_by);
  insert into public.sgi_notifications (company_id, user_id, document_id, kind, title, message)
  values (v_document.company_id, v_target, p_document_id,
    'changes_requested', 'Documento con observaciones',
    v_document.title || ' volvió a borrador con cambios solicitados.');
end;
$$;

create or replace function public.approve_document(
  p_document_id uuid, p_comment text default null
)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_document public.documents%rowtype; v_target uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if not public.has_company_role(v_document.company_id,
       array['admin'::public.company_role, 'responsible'::public.company_role])
     or (not public.has_company_role(v_document.company_id,
       array['admin'::public.company_role]) and v_document.approver_id is distinct from auth.uid())
  then raise exception 'not_designated_approver'; end if;
  if v_document.status <> 'in_progress' then raise exception 'document_not_in_review'; end if;
  if v_document.reviewer_id is not null and v_document.reviewed_at is null
  then raise exception 'review_required_before_approval'; end if;
  update public.documents set status = 'approved' where id = p_document_id;
  insert into public.document_activity
    (document_id, actor_id, action, from_status, to_status, details)
  values (p_document_id, auth.uid(), 'approved', 'in_progress', 'approved',
    jsonb_build_object('comment', nullif(trim(coalesce(p_comment, '')), '')));
  v_target := coalesce(v_document.responsible_id, v_document.created_by);
  insert into public.sgi_notifications
    (company_id, user_id, document_id, kind, title, message)
  values (v_document.company_id, v_target, p_document_id,
    'approved', 'Documento aprobado', v_document.title || ' fue aprobado y quedó vigente.');
end;
$$;

-- Prevent untrusted clients from calling privileged RPCs anonymously.
revoke execute on function public.create_document_version(uuid,text,text,text,bigint,text) from public, anon;
revoke execute on function public.submit_document_for_review(uuid,uuid,uuid,timestamptz,text) from public, anon;
revoke execute on function public.review_document(uuid,text) from public, anon;
revoke execute on function public.reject_document(uuid,text) from public, anon;
revoke execute on function public.approve_document(uuid,text) from public, anon;
grant execute on function public.create_document_version(uuid,text,text,text,bigint,text) to authenticated;
grant execute on function public.submit_document_for_review(uuid,uuid,uuid,timestamptz,text) to authenticated;
grant execute on function public.review_document(uuid,text) to authenticated;
grant execute on function public.reject_document(uuid,text) to authenticated;
grant execute on function public.approve_document(uuid,text) to authenticated;

commit;
