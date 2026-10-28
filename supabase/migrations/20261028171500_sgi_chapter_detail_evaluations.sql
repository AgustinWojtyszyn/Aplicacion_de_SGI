begin;

-- Compliance assessments are independent of documentary approval.
-- No changes to companies, tenant switching, users or existing documents.
create table if not exists public.sgi_requirement_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requirement_id uuid not null references public.sgi_requirements(id) on delete cascade,
  status text not null default 'not_evaluated'
    check (status in ('not_evaluated', 'compliant', 'partial', 'non_compliant', 'not_applicable')),
  remarks text not null default '' check (char_length(remarks) <= 2000),
  evaluated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (company_id, requirement_id)
);

create index if not exists sgi_requirement_evaluations_company_idx
  on public.sgi_requirement_evaluations(company_id, requirement_id);

alter table public.sgi_requirement_evaluations enable row level security;
grant select, insert, update on public.sgi_requirement_evaluations to authenticated;

drop policy if exists sgi_evaluations_read_members on public.sgi_requirement_evaluations;
create policy sgi_evaluations_read_members
on public.sgi_requirement_evaluations for select to authenticated
using (
  public.is_company_member(company_id)
  and exists (
    select 1 from public.sgi_requirements r
    where r.id = requirement_id and r.company_id = company_id
  )
);

drop policy if exists sgi_evaluations_create_authorized on public.sgi_requirement_evaluations;
create policy sgi_evaluations_create_authorized
on public.sgi_requirement_evaluations for insert to authenticated
with check (
  evaluated_by = (select auth.uid())
  and public.has_company_role(
    company_id, array['admin'::public.company_role, 'responsible'::public.company_role]
  )
  and exists (
    select 1 from public.sgi_requirements r
    where r.id = requirement_id and r.company_id = company_id and r.is_active
  )
);

drop policy if exists sgi_evaluations_update_authorized on public.sgi_requirement_evaluations;
create policy sgi_evaluations_update_authorized
on public.sgi_requirement_evaluations for update to authenticated
using (
  public.has_company_role(
    company_id, array['admin'::public.company_role, 'responsible'::public.company_role]
  )
)
with check (
  evaluated_by = (select auth.uid())
  and public.has_company_role(
    company_id, array['admin'::public.company_role, 'responsible'::public.company_role]
  )
  and exists (
    select 1 from public.sgi_requirements r
    where r.id = requirement_id and r.company_id = company_id and r.is_active
  )
);

-- Add the ISO 9001 subrequirements used by the chapter detail design.
-- The existing 9001-4 through 9001-10 chapter roots, document IDs and
-- approvals remain untouched. Existing custom subrequirements are preserved.
-- Only workspaces that already contain the corresponding ISO chapter receive
-- these optional detailed requirement rows.
insert into public.sgi_requirements (company_id, norm, chapter, code, title, description)
select parent.company_id, 'ISO 9001', detail.chapter, detail.code, detail.title, detail.description
from (
  values
    (4, '9001-4.1', 'Comprensión de la organización y su contexto', 'Identificar y revisar factores internos y externos que pueden afectar al sistema de calidad.'),
    (4, '9001-4.2', 'Partes interesadas y sus necesidades', 'Determinar cuáles son las partes interesadas relevantes y qué esperan del sistema de calidad.'),
    (4, '9001-4.3', 'Alcance del sistema de gestión', 'Definir los límites, actividades y aplicabilidad del sistema de gestión de calidad.'),
    (4, '9001-4.4', 'Procesos del sistema de calidad', 'Reconocer los procesos, sus interacciones, responsables, controles y resultados esperados.'),
    (5, '9001-5.1', 'Liderazgo y compromiso', 'Documentar las responsabilidades y evidencias de liderazgo en el sistema.'),
    (5, '9001-5.2', 'Política de calidad', 'Revisar definición, comunicación y disponibilidad de la política de calidad.'),
    (5, '9001-5.3', 'Roles y responsabilidades', 'Definir autoridades, funciones y responsabilidades relevantes.'),
    (6, '9001-6.1', 'Riesgos y oportunidades', 'Planificar el tratamiento de riesgos y oportunidades relevantes.'),
    (6, '9001-6.2', 'Objetivos de calidad', 'Establecer objetivos medibles y planes de seguimiento.'),
    (6, '9001-6.3', 'Planificación de cambios', 'Evaluar y organizar cambios que afectan el sistema.'),
    (7, '9001-7.1', 'Recursos', 'Planificar y disponer de los recursos que necesita el sistema.'),
    (7, '9001-7.2', 'Competencias', 'Verificar conocimientos, formación y competencias requeridas.'),
    (7, '9001-7.3', 'Toma de conciencia', 'Comprobar que las personas conocen los aspectos aplicables del sistema.'),
    (7, '9001-7.4', 'Comunicación', 'Establecer la información, medios, responsables y oportunidad de comunicación.'),
    (7, '9001-7.5', 'Información documentada', 'Controlar creación, actualización, disponibilidad y protección de documentos.'),
    (8, '9001-8.1', 'Planificación y control operacional', 'Controlar y registrar la operación de los procesos previstos.'),
    (8, '9001-8.2', 'Requisitos para productos y servicios', 'Determinar y revisar requisitos y comunicaciones con clientes.'),
    (8, '9001-8.3', 'Diseño y desarrollo', 'Gestionar las actividades de diseño cuando resulten aplicables.'),
    (8, '9001-8.4', 'Procesos y proveedores externos', 'Definir criterios de evaluación, selección y control de proveedores externos.'),
    (8, '9001-8.5', 'Producción y prestación del servicio', 'Aplicar controles operativos, trazabilidad y preservación pertinente.'),
    (8, '9001-8.6', 'Liberación de productos y servicios', 'Registrar controles y autorizaciones previos a la entrega.'),
    (8, '9001-8.7', 'Salidas no conformes', 'Identificar y tratar productos o servicios que no cumplen los requisitos.'),
    (9, '9001-9.1', 'Seguimiento, medición y análisis', 'Definir indicadores, medir resultados y evaluar desempeño y satisfacción.'),
    (9, '9001-9.2', 'Auditoría interna', 'Planificar y registrar auditorías del sistema de gestión.'),
    (9, '9001-9.3', 'Revisión por la dirección', 'Registrar resultados, decisiones y seguimiento de la revisión directiva.'),
    (10, '9001-10.1', 'Oportunidades de mejora', 'Identificar y priorizar mejoras para el sistema y sus resultados.'),
    (10, '9001-10.2', 'No conformidades y acciones correctivas', 'Registrar hallazgos, analizar causas y verificar las acciones correctivas.'),
    (10, '9001-10.3', 'Mejora continua', 'Evaluar la eficacia de las mejoras incorporadas.')
) as detail(chapter, code, title, description)
join public.sgi_requirements parent
  on parent.norm = 'ISO 9001'
 and parent.chapter = detail.chapter
 and parent.code = '9001-' || detail.chapter::text
 and parent.is_active
on conflict (company_id, norm, code) do nothing;

-- A chapter root should be unique per workspace and chapter, as defined by
-- the original seed. No changes to document references are performed.
notify pgrst, 'reload schema';

commit;
