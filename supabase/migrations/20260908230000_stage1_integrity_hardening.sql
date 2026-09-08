begin;

create or replace function public.validate_document_references()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.module_id is not null and not exists (
    select 1
    from public.modules m
    where m.id = new.module_id
      and m.company_id = new.company_id
      and m.is_active = true
  ) then
    raise exception 'document_module_must_belong_to_company';
  end if;

  if new.responsible_id is not null and not public.is_company_member(new.company_id, new.responsible_id) then
    raise exception 'document_responsible_must_belong_to_company';
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.document_type is distinct from old.document_type
    or new.norm is distinct from old.norm
    or new.module_id is distinct from old.module_id
    or new.responsible_id is distinct from old.responsible_id
  ) then
    raise exception 'approved_document_is_read_only';
  end if;

  return new;
end;
$$;

drop trigger if exists documents_validate_references on public.documents;
create trigger documents_validate_references
before insert or update on public.documents
for each row execute function public.validate_document_references();

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
      jsonb_build_object('from', old.responsible_id, 'to', new.responsible_id)
    );
  elsif new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.document_type is distinct from old.document_type
    or new.norm is distinct from old.norm
    or new.module_id is distinct from old.module_id then
    insert into public.document_activity (document_id, actor_id, action, details)
    values (
      new.id,
      coalesce(auth.uid(), new.created_by),
      'metadata_updated',
      jsonb_build_object('title', new.title)
    );
  end if;

  return new;
end;
$$;

commit;
