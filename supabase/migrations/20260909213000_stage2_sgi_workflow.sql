begin;

create table if not exists public.sgi_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  norm text not null check (norm in ('ISO 9001', 'ISO 14001', 'ISO 45001', 'SGI')),
  chapter smallint not null check (chapter between 4 and 10),
  code text not null,
  title text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, norm, code)
);

alter table public.documents
  add column if not exists requirement_id uuid references public.sgi_requirements(id) on delete set null,
  add column if not exists reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists approver_id uuid references public.profiles(id) on delete set null,
  add column if not exists review_due_at timestamptz,
  add column if not exists current_version integer not null default 1 check (current_version >= 1),
  add column if not exists submitted_for_review_at timestamptz,
  add column if not exists reviewed_at timestamptz;

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  file_name text not null,
  file_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0 and file_size <= 26214400),
  comment text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create table if not exists public.sgi_notifications (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  kind text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sgi_requirements_company_norm_idx on public.sgi_requirements(company_id, norm, chapter);
create index if not exists documents_requirement_idx on public.documents(requirement_id);
create index if not exists documents_reviewer_idx on public.documents(reviewer_id, status);
create index if not exists documents_approver_idx on public.documents(approver_id, status);
create index if not exists documents_review_due_idx on public.documents(review_due_at) where status <> 'approved';
create index if not exists document_versions_document_idx on public.document_versions(document_id, version_number desc);
create index if not exists sgi_notifications_user_idx on public.sgi_notifications(user_id, read_at, created_at desc);

insert into public.sgi_requirements (company_id, norm, chapter, code, title, description)
select c.id, seed.norm, seed.chapter, seed.code, seed.title, seed.description
from public.companies c
cross join (
  values
    ('ISO 9001', 4, '9001-4', 'Contexto de la organización', 'Contexto, alcance y partes interesadas del sistema de calidad.'),
    ('ISO 9001', 5, '9001-5', 'Liderazgo y enfoque al cliente', 'Liderazgo, política, responsabilidades y enfoque al cliente.'),
    ('ISO 9001', 6, '9001-6', 'Planificación', 'Riesgos, oportunidades y objetivos de calidad.'),
    ('ISO 9001', 7, '9001-7', 'Apoyo', 'Recursos, competencias, comunicación e información documentada.'),
    ('ISO 9001', 8, '9001-8', 'Operación', 'Requisitos de productos y servicios, proveedores y control operacional.'),
    ('ISO 9001', 9, '9001-9', 'Evaluación del desempeño', 'Seguimiento, satisfacción del cliente, auditorías y revisión.'),
    ('ISO 9001', 10, '9001-10', 'Mejora', 'No conformidades, acciones correctivas y mejora continua.'),
    ('ISO 14001', 4, '14001-4', 'Contexto de la organización', 'Contexto, alcance y partes interesadas de la gestión ambiental.'),
    ('ISO 14001', 5, '14001-5', 'Liderazgo y política ambiental', 'Liderazgo, política y responsabilidades ambientales.'),
    ('ISO 14001', 6, '14001-6', 'Planificación', 'Aspectos ambientales, requisitos legales, riesgos y objetivos.'),
    ('ISO 14001', 7, '14001-7', 'Apoyo', 'Recursos, competencias, toma de conciencia, comunicación y documentación.'),
    ('ISO 14001', 8, '14001-8', 'Operación', 'Control operacional y preparación ante emergencias ambientales.'),
    ('ISO 14001', 9, '14001-9', 'Evaluación del desempeño', 'Seguimiento, cumplimiento, auditorías y revisión por la dirección.'),
    ('ISO 14001', 10, '14001-10', 'Mejora', 'No conformidades, acciones correctivas y mejora continua.'),
    ('ISO 45001', 4, '45001-4', 'Contexto y alcance', 'Contexto, necesidades de trabajadores y alcance del sistema SST.'),
    ('ISO 45001', 5, '45001-5', 'Liderazgo y participación', 'Liderazgo, política y participación de los trabajadores.'),
    ('ISO 45001', 6, '45001-6', 'Planificación', 'Peligros, riesgos, oportunidades, requisitos legales y objetivos.'),
    ('ISO 45001', 7, '45001-7', 'Apoyo', 'Recursos, competencias, comunicación e información documentada.'),
    ('ISO 45001', 8, '45001-8', 'Operación', 'Eliminación de peligros, control operacional y emergencias.'),
    ('ISO 45001', 9, '45001-9', 'Evaluación del desempeño', 'Seguimiento, cumplimiento, auditorías y revisión.'),
    ('ISO 45001', 10, '45001-10', 'Mejora', 'Incidentes, acciones correctivas y mejora continua.'),
    ('SGI', 4, 'SGI-4', 'Contexto de la organización', 'Estructura común de contexto, alcance y partes interesadas.'),
    ('SGI', 5, 'SGI-5', 'Liderazgo y compromiso', 'Política integrada, liderazgo, responsabilidades y participación.'),
    ('SGI', 6, 'SGI-6', 'Planificación integrada', 'Riesgos, oportunidades, requisitos legales y objetivos integrados.'),
    ('SGI', 7, 'SGI-7', 'Apoyo integrado', 'Recursos, competencias, comunicación e información documentada común.'),
    ('SGI', 8, 'SGI-8', 'Planificación y control operacional', 'Controles operacionales integrados y preparación ante emergencias.'),
    ('SGI', 9, 'SGI-9', 'Evaluación del desempeño', 'Seguimiento, medición, auditorías y revisión por la dirección.'),
    ('SGI', 10, 'SGI-10', 'Mejora continua', 'Incidentes, no conformidades, acciones correctivas y mejora integrada.')
) as seed(norm, chapter, code, title, description)
where c.slug = 'ep-consultora'
on conflict (company_id, norm, code) do update
set chapter = excluded.chapter,
    title = excluded.title,
    description = excluded.description,
    is_active = true;

insert into public.document_versions (
  document_id, version_number, file_name, file_path, mime_type, file_size, comment, created_by, created_at
)
select d.id, 1, d.file_name, d.file_path, d.mime_type, d.file_size, 'Versión inicial migrada desde Etapa 1', d.created_by, d.created_at
from public.documents d
where not exists (
  select 1 from public.document_versions v where v.document_id = d.id
)
on conflict (document_id, version_number) do nothing;

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
before insert or update of requirement_id, reviewer_id, approver_id on public.documents
for each row execute function public.validate_document_sgi_links();

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
  if v_document.status = 'approved' then raise exception 'approved_document_is_locked'; end if;

  if not (
    v_document.created_by = auth.uid()
    or v_document.responsible_id = auth.uid()
    or public.has_company_role(v_document.company_id, array['admin'::public.company_role, 'responsible'::public.company_role])
  ) then raise exception 'not_authorized'; end if;

  v_version := v_document.current_version + 1;

  insert into public.document_versions (
    document_id, version_number, file_name, file_path, mime_type, file_size, comment, created_by
  ) values (
    p_document_id, v_version, trim(p_file_name), p_file_path, p_mime_type, p_file_size,
    nullif(trim(coalesce(p_comment, '')), ''), auth.uid()
  );

  update public.documents set current_version = v_version where id = p_document_id;

  insert into public.document_activity (document_id, actor_id, action, details)
  values (p_document_id, auth.uid(), 'version_created', jsonb_build_object('version', v_version, 'file_name', p_file_name));

  return v_version;
end;
$$;

create or replace function public.submit_document_for_review(
  p_document_id uuid,
  p_reviewer_id uuid,
  p_approver_id uuid,
  p_review_due_at timestamptz default null,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.documents%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if v_document.status <> 'draft' then raise exception 'document_must_be_draft'; end if;

  if not (
    v_document.created_by = auth.uid()
    or v_document.responsible_id = auth.uid()
    or public.has_company_role(v_document.company_id, array['admin'::public.company_role, 'responsible'::public.company_role])
  ) then raise exception 'not_authorized'; end if;

  if not public.is_company_member(v_document.company_id, p_reviewer_id) then raise exception 'invalid_reviewer'; end if;
  if not public.is_company_member(v_document.company_id, p_approver_id) then raise exception 'invalid_approver'; end if;

  update public.documents
  set status = 'in_progress', reviewer_id = p_reviewer_id, approver_id = p_approver_id,
      review_due_at = p_review_due_at, submitted_for_review_at = now(), reviewed_at = null
  where id = p_document_id;

  insert into public.document_activity (document_id, actor_id, action, from_status, to_status, details)
  values (p_document_id, auth.uid(), 'submitted_for_review', 'draft', 'in_progress',
    jsonb_build_object('reviewer_id', p_reviewer_id, 'approver_id', p_approver_id, 'comment', nullif(trim(coalesce(p_comment, '')), '')));

  insert into public.sgi_notifications (company_id, user_id, document_id, kind, title, message)
  values (v_document.company_id, p_reviewer_id, p_document_id, 'review_requested', 'Documento para revisar', v_document.title || ' espera tu revisión.');
end;
$$;

create or replace function public.review_document(
  p_document_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.documents%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if v_document.status <> 'in_progress' then raise exception 'document_not_in_review'; end if;
  if v_document.reviewer_id is distinct from auth.uid()
     and not public.has_company_role(v_document.company_id, array['admin'::public.company_role]) then
    raise exception 'not_designated_reviewer';
  end if;

  update public.documents set reviewed_at = now() where id = p_document_id;
  insert into public.document_activity (document_id, actor_id, action, details)
  values (p_document_id, auth.uid(), 'reviewed', jsonb_build_object('comment', nullif(trim(coalesce(p_comment, '')), '')));

  if v_document.approver_id is not null then
    insert into public.sgi_notifications (company_id, user_id, document_id, kind, title, message)
    values (v_document.company_id, v_document.approver_id, p_document_id, 'approval_requested', 'Documento listo para aprobar', v_document.title || ' fue revisado y espera aprobación.');
  end if;
end;
$$;

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
  if auth.uid() not in (coalesce(v_document.reviewer_id, auth.uid()), coalesce(v_document.approver_id, auth.uid()))
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

create or replace function public.approve_document(
  p_document_id uuid,
  p_comment text default null
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
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'document_not_found'; end if;
  if v_document.status <> 'in_progress' then raise exception 'document_not_in_review'; end if;
  if v_document.reviewer_id is not null and v_document.reviewed_at is null then raise exception 'review_required_before_approval'; end if;
  if v_document.approver_id is distinct from auth.uid()
     and not public.has_company_role(v_document.company_id, array['admin'::public.company_role]) then
    raise exception 'not_designated_approver';
  end if;

  update public.documents set status = 'approved' where id = p_document_id;
  insert into public.document_activity (document_id, actor_id, action, from_status, to_status, details)
  values (p_document_id, auth.uid(), 'approved', 'in_progress', 'approved', jsonb_build_object('comment', nullif(trim(coalesce(p_comment, '')), '')));

  v_target := coalesce(v_document.responsible_id, v_document.created_by);
  insert into public.sgi_notifications (company_id, user_id, document_id, kind, title, message)
  values (v_document.company_id, v_target, p_document_id, 'approved', 'Documento aprobado', v_document.title || ' fue aprobado y quedó vigente.');
end;
$$;

alter table public.sgi_requirements enable row level security;
alter table public.document_versions enable row level security;
alter table public.sgi_notifications enable row level security;

drop policy if exists sgi_requirements_select_member on public.sgi_requirements;
create policy sgi_requirements_select_member on public.sgi_requirements for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists sgi_requirements_manage_admin on public.sgi_requirements;
create policy sgi_requirements_manage_admin on public.sgi_requirements for all to authenticated
using (public.has_company_role(company_id, array['admin'::public.company_role]))
with check (public.has_company_role(company_id, array['admin'::public.company_role]));

drop policy if exists document_versions_select_member on public.document_versions;
create policy document_versions_select_member on public.document_versions for select to authenticated
using (exists (select 1 from public.documents d where d.id = document_id and public.is_company_member(d.company_id)));

drop policy if exists notifications_select_self on public.sgi_notifications;
create policy notifications_select_self on public.sgi_notifications for select to authenticated
using (user_id = auth.uid() and public.is_company_member(company_id));

drop policy if exists notifications_update_self on public.sgi_notifications;
create policy notifications_update_self on public.sgi_notifications for update to authenticated
using (user_id = auth.uid() and public.is_company_member(company_id))
with check (user_id = auth.uid() and public.is_company_member(company_id));

-- New version files live under the same company/document folder structure used by Stage 1.
drop policy if exists documents_insert_storage_member on storage.objects;
create policy documents_insert_storage_member
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'sgi-documents'
  and public.is_company_member(public.safe_storage_company_id(name))
);

commit;
