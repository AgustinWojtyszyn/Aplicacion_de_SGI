begin;

-- EP Consultora platform administrators are separate from administrators of a
-- client company. Company admins manage only their own workspace; platform
-- admins can create and supervise every client workspace.
create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- Preserve the current installation by promoting only the earliest active
-- administrator when no explicit platform administrator exists yet.
insert into public.platform_admins (user_id)
select cm.user_id
from public.company_members cm
where cm.role = 'admin'
  and cm.is_active = true
  and not exists (select 1 from public.platform_admins)
order by cm.joined_at asc, cm.user_id asc
limit 1
on conflict (user_id) do nothing;

-- Remove the legacy client-specific seed name from an already-installed DB.
do $$
declare
  v_legacy_id uuid;
begin
  select id into v_legacy_id
  from public.companies
  where slug = 'sf-higiene' or lower(name) = 'sf higiene'
  limit 1;

  if v_legacy_id is not null then
    if not exists (select 1 from public.companies where slug = 'ep-consultora' and id <> v_legacy_id) then
      update public.companies
      set name = 'EP Consultora', slug = 'ep-consultora', is_active = true
      where id = v_legacy_id;
    else
      update public.companies
      set name = 'Espacio migrado',
          slug = 'espacio-migrado-' || left(v_legacy_id::text, 8),
          is_active = false
      where id = v_legacy_id;
    end if;
  end if;
end;
$$;

drop function if exists public.bootstrap_sf_higiene_admin();

create or replace function public.is_platform_admin(
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
      from public.platform_admins pa
      where pa.user_id = p_user_id
    );
$$;

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
    and (
      public.is_platform_admin(p_user_id)
      or exists (
        select 1
        from public.company_members cm
        where cm.company_id = p_company_id
          and cm.user_id = p_user_id
          and cm.is_active = true
      )
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
    and (
      ('admin'::public.company_role = any(p_roles) and public.is_platform_admin(p_user_id))
      or exists (
        select 1
        from public.company_members cm
        where cm.company_id = p_company_id
          and cm.user_id = p_user_id
          and cm.is_active = true
          and cm.role = any(p_roles)
      )
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
    and (
      public.is_platform_admin(p_user_id)
      or exists (
        select 1
        from public.company_members mine
        join public.company_members theirs
          on theirs.company_id = mine.company_id
        where mine.user_id = p_user_id
          and mine.is_active = true
          and theirs.user_id = p_other_user_id
      )
    );
$$;

create or replace function public.seed_company_defaults(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.modules (company_id, name, code, description, is_active)
  values
    (p_company_id, 'Gestión Documental', 'DOC', 'Documentación general y control documental interno.', true),
    (p_company_id, 'Calidad', 'CALIDAD', 'Documentación vinculada con calidad y mejora.', true),
    (p_company_id, 'Ambiente', 'AMBIENTE', 'Documentación vinculada con gestión ambiental.', true),
    (p_company_id, 'Seguridad y Salud', 'SST', 'Documentación de seguridad y salud en el trabajo.', true),
    (p_company_id, 'Administración', 'ADMIN', 'Documentación administrativa y de soporte.', true)
  on conflict (company_id, code) do update
    set name = excluded.name,
        description = excluded.description,
        is_active = true;

  insert into public.sgi_requirements (company_id, norm, chapter, code, title, description, is_active)
  values
    (p_company_id, 'ISO 9001', 4, '9001-4', 'Contexto de la organización', 'Contexto, alcance y partes interesadas del sistema de calidad.', true),
    (p_company_id, 'ISO 9001', 5, '9001-5', 'Liderazgo y enfoque al cliente', 'Liderazgo, política, responsabilidades y enfoque al cliente.', true),
    (p_company_id, 'ISO 9001', 6, '9001-6', 'Planificación', 'Riesgos, oportunidades y objetivos de calidad.', true),
    (p_company_id, 'ISO 9001', 7, '9001-7', 'Apoyo', 'Recursos, competencias, comunicación e información documentada.', true),
    (p_company_id, 'ISO 9001', 8, '9001-8', 'Operación', 'Requisitos de productos y servicios, proveedores y control operacional.', true),
    (p_company_id, 'ISO 9001', 9, '9001-9', 'Evaluación del desempeño', 'Seguimiento, satisfacción del cliente, auditorías y revisión.', true),
    (p_company_id, 'ISO 9001', 10, '9001-10', 'Mejora', 'No conformidades, acciones correctivas y mejora continua.', true),
    (p_company_id, 'ISO 14001', 4, '14001-4', 'Contexto de la organización', 'Contexto, alcance y partes interesadas de la gestión ambiental.', true),
    (p_company_id, 'ISO 14001', 5, '14001-5', 'Liderazgo y política ambiental', 'Liderazgo, política y responsabilidades ambientales.', true),
    (p_company_id, 'ISO 14001', 6, '14001-6', 'Planificación', 'Aspectos ambientales, requisitos legales, riesgos y objetivos.', true),
    (p_company_id, 'ISO 14001', 7, '14001-7', 'Apoyo', 'Recursos, competencias, toma de conciencia, comunicación y documentación.', true),
    (p_company_id, 'ISO 14001', 8, '14001-8', 'Operación', 'Control operacional y preparación ante emergencias ambientales.', true),
    (p_company_id, 'ISO 14001', 9, '14001-9', 'Evaluación del desempeño', 'Seguimiento, cumplimiento, auditorías y revisión por la dirección.', true),
    (p_company_id, 'ISO 14001', 10, '14001-10', 'Mejora', 'No conformidades, acciones correctivas y mejora continua.', true),
    (p_company_id, 'ISO 45001', 4, '45001-4', 'Contexto y alcance', 'Contexto, necesidades de trabajadores y alcance del sistema SST.', true),
    (p_company_id, 'ISO 45001', 5, '45001-5', 'Liderazgo y participación', 'Liderazgo, política y participación de los trabajadores.', true),
    (p_company_id, 'ISO 45001', 6, '45001-6', 'Planificación', 'Peligros, riesgos, oportunidades, requisitos legales y objetivos.', true),
    (p_company_id, 'ISO 45001', 7, '45001-7', 'Apoyo', 'Recursos, competencias, comunicación e información documentada.', true),
    (p_company_id, 'ISO 45001', 8, '45001-8', 'Operación', 'Eliminación de peligros, control operacional y emergencias.', true),
    (p_company_id, 'ISO 45001', 9, '45001-9', 'Evaluación del desempeño', 'Seguimiento, cumplimiento, auditorías y revisión.', true),
    (p_company_id, 'ISO 45001', 10, '45001-10', 'Mejora', 'Incidentes, acciones correctivas y mejora continua.', true),
    (p_company_id, 'SGI', 4, 'SGI-4', 'Contexto de la organización', 'Estructura común de contexto, alcance y partes interesadas.', true),
    (p_company_id, 'SGI', 5, 'SGI-5', 'Liderazgo y compromiso', 'Política integrada, liderazgo, responsabilidades y participación.', true),
    (p_company_id, 'SGI', 6, 'SGI-6', 'Planificación integrada', 'Riesgos, oportunidades, requisitos legales y objetivos integrados.', true),
    (p_company_id, 'SGI', 7, 'SGI-7', 'Apoyo integrado', 'Recursos, competencias, comunicación e información documentada común.', true),
    (p_company_id, 'SGI', 8, 'SGI-8', 'Planificación y control operacional', 'Controles operacionales integrados y preparación ante emergencias.', true),
    (p_company_id, 'SGI', 9, 'SGI-9', 'Evaluación del desempeño', 'Seguimiento, medición, auditorías y revisión por la dirección.', true),
    (p_company_id, 'SGI', 10, 'SGI-10', 'Mejora continua', 'Incidentes, no conformidades, acciones correctivas y mejora integrada.', true)
  on conflict (company_id, norm, code) do update
    set chapter = excluded.chapter,
        title = excluded.title,
        description = excluded.description,
        is_active = true;
end;
$$;

-- Ensure every existing workspace has its own default modules and SGI matrix.
do $$
declare
  v_company_id uuid;
begin
  for v_company_id in select id from public.companies where is_active = true loop
    perform public.seed_company_defaults(v_company_id);
  end loop;
end;
$$;

create or replace function public.create_company_workspace(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_platform_admin(auth.uid()) then
    raise exception 'not_authorized';
  end if;

  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'invalid_company_name';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid_company_slug';
  end if;

  insert into public.companies (name, slug, is_active)
  values (v_name, v_slug, true)
  returning id into v_company_id;

  perform public.seed_company_defaults(v_company_id);

  return v_company_id;
exception
  when unique_violation then
    raise exception 'company_slug_already_exists';
end;
$$;

revoke all on table public.platform_admins from public, anon, authenticated;
revoke all on function public.seed_company_defaults(uuid) from public, anon, authenticated;
revoke all on function public.is_platform_admin(uuid) from public;
revoke all on function public.create_company_workspace(text, text) from public;
grant execute on function public.is_platform_admin(uuid) to authenticated;
grant execute on function public.create_company_workspace(text, text) to authenticated;

commit;
