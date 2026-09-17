begin;

-- Allow Auth users to be removed without deleting business records.
-- Identity-bearing profile rows are deleted through the existing
-- auth.users -> public.profiles ON DELETE CASCADE relationship, while
-- historical documents/work entries keep their business data and lose the
-- reference to the removed profile.

alter table public.documents
  alter column created_by drop not null;
alter table public.documents
  drop constraint if exists documents_created_by_fkey;
alter table public.documents
  add constraint documents_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.document_comments
  alter column author_id drop not null;
alter table public.document_comments
  drop constraint if exists document_comments_author_id_fkey;
alter table public.document_comments
  add constraint document_comments_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;

alter table public.document_versions
  alter column created_by drop not null;
alter table public.document_versions
  drop constraint if exists document_versions_created_by_fkey;
alter table public.document_versions
  add constraint document_versions_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.work_entries
  alter column created_by drop not null,
  alter column updated_by drop not null;
alter table public.work_entries
  drop constraint if exists work_entries_created_by_fkey;
alter table public.work_entries
  drop constraint if exists work_entries_updated_by_fkey;
alter table public.work_entries
  add constraint work_entries_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;
alter table public.work_entries
  add constraint work_entries_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

commit;
