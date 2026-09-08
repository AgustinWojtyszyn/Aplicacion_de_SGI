begin;

drop policy if exists sgi_documents_delete_managers on storage.objects;
create policy sgi_documents_delete_managers
on storage.objects for delete
to authenticated
using (
  bucket_id = 'sgi-documents'
  and (
    public.has_company_role(
      public.safe_storage_company_id(name),
      array['admin'::public.company_role, 'responsible'::public.company_role]
    )
    or exists (
      select 1
      from public.documents d
      where d.file_path = name
        and d.created_by = auth.uid()
        and d.status = 'draft'
        and public.is_company_member(d.company_id)
    )
  )
);

commit;
