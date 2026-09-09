begin;

create or replace function public.seed_initial_document_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.document_versions (
    document_id, version_number, file_name, file_path, mime_type, file_size, comment, created_by, created_at
  ) values (
    new.id, 1, new.file_name, new.file_path, new.mime_type, new.file_size,
    'Versión inicial', new.created_by, new.created_at
  )
  on conflict (document_id, version_number) do nothing;
  return new;
end;
$$;

drop trigger if exists documents_seed_initial_version on public.documents;
create trigger documents_seed_initial_version
after insert on public.documents
for each row execute function public.seed_initial_document_version();

create or replace function public.reject_document(
  p_document_id uuid,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.documents%rowtype;
  v_target uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if nullif(trim(coalesce(p_comment, '')), '') is null then raise exception 'rejection_comment_required'; end if;

  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if v_document.status <> 'in_progress' then raise exception 'document_not_in_review'; end if;

  if auth.uid() is distinct from v_document.reviewer_id
     and auth.uid() is distinct from v_document.approver_id
     and not public.has_company_role(v_document.company_id, array['admin'::public.company_role]) then
    raise exception 'not_authorized';
  end if;

  update public.documents
  set status = 'draft', reviewed_at = null, submitted_for_review_at = null
  where id = p_document_id;

  insert into public.document_activity (document_id, actor_id, action, from_status, to_status, details)
  values (p_document_id, auth.uid(), 'rejected', 'in_progress', 'draft', jsonb_build_object('comment', trim(p_comment)));

  v_target := coalesce(v_document.responsible_id, v_document.created_by);
  insert into public.sgi_notifications (company_id, user_id, document_id, kind, title, message)
  values (v_document.company_id, v_target, p_document_id, 'changes_requested', 'Documento con observaciones', v_document.title || ' volvió a borrador con cambios solicitados.');
end;
$$;

-- Keep one canonical insert policy for the private document bucket.
drop policy if exists documents_insert_storage_member on storage.objects;
drop policy if exists sgi_documents_insert_members on storage.objects;
create policy sgi_documents_insert_members
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'sgi-documents'
  and public.is_company_member(public.safe_storage_company_id(name))
);

grant select on public.sgi_requirements to authenticated;
grant select on public.document_versions to authenticated;
grant select on public.sgi_notifications to authenticated;
revoke update on public.sgi_notifications from authenticated;
grant update (read_at) on public.sgi_notifications to authenticated;
grant usage, select on sequence public.sgi_notifications_id_seq to authenticated;

grant execute on function public.create_document_version(uuid, text, text, text, bigint, text) to authenticated;
grant execute on function public.submit_document_for_review(uuid, uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.review_document(uuid, text) to authenticated;
grant execute on function public.reject_document(uuid, text) to authenticated;
grant execute on function public.approve_document(uuid, text) to authenticated;

commit;
