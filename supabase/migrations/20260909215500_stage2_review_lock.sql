begin;

create or replace function public.validate_document_references()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.module_id is not null and not exists (
    select 1 from public.modules m
    where m.id = new.module_id and m.company_id = new.company_id and m.is_active = true
  ) then
    raise exception 'document_module_must_belong_to_company';
  end if;

  if new.responsible_id is not null and not public.is_company_member(new.company_id, new.responsible_id) then
    raise exception 'document_responsible_must_belong_to_company';
  end if;

  if tg_op = 'UPDATE' and old.status <> 'draft' and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.document_type is distinct from old.document_type
    or new.norm is distinct from old.norm
    or new.module_id is distinct from old.module_id
    or new.requirement_id is distinct from old.requirement_id
    or new.responsible_id is distinct from old.responsible_id
    or new.review_due_at is distinct from old.review_due_at
  ) then
    raise exception 'document_metadata_locked_during_review';
  end if;

  return new;
end;
$$;

create or replace function public.create_document_version(
  p_document_id uuid,
  p_file_name text,
  p_file_path text,
  p_mime_type text,
  p_file_size bigint,
  p_comment text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.documents%rowtype;
  v_version integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if v_document.status <> 'draft' then raise exception 'new_version_requires_draft'; end if;
  if not (
    v_document.created_by = auth.uid()
    or v_document.responsible_id = auth.uid()
    or public.has_company_role(v_document.company_id, array['admin'::public.company_role, 'responsible'::public.company_role])
  ) then raise exception 'not_authorized'; end if;

  v_version := v_document.current_version + 1;
  insert into public.document_versions (document_id, version_number, file_name, file_path, mime_type, file_size, comment, created_by)
  values (p_document_id, v_version, trim(p_file_name), p_file_path, p_mime_type, p_file_size, nullif(trim(coalesce(p_comment, '')), ''), auth.uid());
  update public.documents set current_version = v_version where id = p_document_id;
  insert into public.document_activity (document_id, actor_id, action, details)
  values (p_document_id, auth.uid(), 'version_created', jsonb_build_object('version', v_version, 'file_name', p_file_name));
  return v_version;
end;
$$;

commit;
