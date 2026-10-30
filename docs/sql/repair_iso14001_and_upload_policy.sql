-- Ejecutar completo en el SQL Editor del proyecto SGI/GESTIQA.
-- Reparación idempotente. No ejecutar en los proyectos ServiFood.
-- No modifica documentos, carpetas, versiones, aprobaciones ni membresías.
begin;

-- Completar raíces ausentes sin sobreescribir personalizaciones.
insert into public.sgi_requirements (company_id, norm, chapter, code, title, description)
select c.id, 'ISO 14001', s.chapter, '14001-' || s.chapter::text, s.title, s.title
from (
  select company.id
  from public.companies company
  where company.is_active
    and exists (
      select 1 from public.sgi_requirements existing
      where existing.company_id = company.id
        and existing.norm = 'ISO 14001'
        and existing.is_active
    )
) c
cross join (values
  (4, 'Contexto de la organización'),
  (5, 'Liderazgo y política ambiental'),
  (6, 'Planificación'),
  (7, 'Apoyo'),
  (8, 'Operación'),
  (9, 'Evaluación del desempeño'),
  (10, 'Mejora')
) s(chapter, title)
on conflict (company_id, norm, code) do nothing;

-- Completar cláusulas sin depender de la existencia de cada raíz.
insert into public.sgi_requirements (company_id, norm, chapter, code, title, description)
select c.id, 'ISO 14001', detail.chapter, detail.code, detail.title, detail.description
from (
  select company.id
  from public.companies company
  where company.is_active
    and exists (
      select 1 from public.sgi_requirements existing
      where existing.company_id = company.id
        and existing.norm = 'ISO 14001'
        and existing.is_active
    )
) c
cross join (
  values
    (4, '14001-4.1', 'Comprensión de la organización y su contexto', 'Identificar factores internos y externos relevantes para el desempeño ambiental.'),
    (4, '14001-4.2', 'Necesidades y expectativas de las partes interesadas', 'Identificar partes interesadas, necesidades y obligaciones de cumplimiento relevantes.'),
    (4, '14001-4.3', 'Alcance del sistema de gestión ambiental', 'Definir límites, actividades y aplicabilidad del sistema de gestión ambiental.'),
    (4, '14001-4.4', 'Sistema de gestión ambiental', 'Establecer y mantener los procesos necesarios para la gestión ambiental.'),
    (5, '14001-5.1', 'Liderazgo y compromiso', 'Registrar compromisos de dirección con el sistema y su eficacia.'),
    (5, '14001-5.2', 'Política ambiental', 'Definir, comunicar y mantener disponible la política ambiental.'),
    (5, '14001-5.3', 'Roles, responsabilidades y autoridades', 'Asignar y comunicar responsabilidades y autoridades del sistema ambiental.'),
    (6, '14001-6.1.1', 'Acciones para abordar riesgos y oportunidades', 'Determinar riesgos y oportunidades del sistema de gestión ambiental.'),
    (6, '14001-6.1.2', 'Aspectos ambientales', 'Identificar aspectos ambientales, impactos y criterios de significancia.'),
    (6, '14001-6.1.3', 'Obligaciones de cumplimiento', 'Identificar los requisitos legales y otros compromisos ambientales aplicables.'),
    (6, '14001-6.1.4', 'Planificación de acciones', 'Planificar respuestas a aspectos significativos, obligaciones, riesgos y oportunidades.'),
    (6, '14001-6.2.1', 'Objetivos ambientales', 'Establecer objetivos ambientales coherentes con la política y verificables.'),
    (6, '14001-6.2.2', 'Planificación para lograr los objetivos ambientales', 'Definir acciones, responsables, recursos, plazos e indicadores para los objetivos.'),
    (7, '14001-7.1', 'Recursos', 'Determinar y disponer de recursos para el sistema de gestión ambiental.'),
    (7, '14001-7.2', 'Competencia', 'Verificar competencias y conservar evidencias de formación pertinente.'),
    (7, '14001-7.3', 'Toma de conciencia', 'Asegurar la comprensión de impactos, obligaciones y contribuciones ambientales.'),
    (7, '14001-7.4.1', 'Comunicación: generalidades', 'Definir contenido, momento, destinatarios y métodos de comunicación.'),
    (7, '14001-7.4.2', 'Comunicación interna', 'Gestionar información ambiental entre niveles y áreas de la organización.'),
    (7, '14001-7.4.3', 'Comunicación externa', 'Gestionar comunicaciones ambientales con las partes interesadas externas.'),
    (7, '14001-7.5.1', 'Información documentada: generalidades', 'Determinar qué documentación requiere el sistema ambiental.'),
    (7, '14001-7.5.2', 'Creación y actualización de documentos', 'Controlar identificación, formato, revisión y actualización de la documentación.'),
    (7, '14001-7.5.3', 'Control de la información documentada', 'Asegurar disponibilidad, protección y conservación de registros y documentos.'),
    (8, '14001-8.1', 'Planificación y control operacional', 'Establecer controles operacionales y de cambios pertinentes al ciclo de vida.'),
    (8, '14001-8.2', 'Preparación y respuesta ante emergencias', 'Definir, practicar y revisar respuestas a posibles emergencias ambientales.'),
    (9, '14001-9.1.1', 'Seguimiento, medición, análisis y evaluación', 'Definir indicadores y métodos para evaluar resultados ambientales.'),
    (9, '14001-9.1.2', 'Evaluación del cumplimiento', 'Evaluar y registrar periódicamente el cumplimiento de las obligaciones aplicables.'),
    (9, '14001-9.2.1', 'Auditoría interna: generalidades', 'Verificar la conformidad y eficacia del sistema mediante auditorías internas.'),
    (9, '14001-9.2.2', 'Programa de auditoría interna', 'Organizar auditorías, criterios, responsables, alcance e informes.'),
    (9, '14001-9.3', 'Revisión por la dirección', 'Registrar las revisiones de dirección y las decisiones resultantes.'),
    (10, '14001-10.1', 'Mejora: generalidades', 'Identificar oportunidades de mejora relevantes para el desempeño ambiental.'),
    (10, '14001-10.2', 'No conformidad y acción correctiva', 'Analizar desviaciones y causas, aplicar correcciones y verificar su eficacia.'),
    (10, '14001-10.3', 'Mejora continua', 'Mejorar continuamente la idoneidad, suficiencia y eficacia del sistema ambiental.')

) as detail(chapter, code, title, description)
on conflict (company_id, norm, code) do nothing;

-- En la subconsulta, "name" sin calificar puede resolverse a companies.name.
-- Debe usarse la ruta de storage.objects, cuyo primer segmento es company_id.
drop policy if exists sgi_documents_insert_members on storage.objects;
create policy sgi_documents_insert_members
on storage.objects for insert to authenticated
with check (
  bucket_id = 'sgi-documents'
  and exists (
    select 1 from public.companies c
    where c.id = public.safe_storage_company_id(objects.name)
      and c.is_active = true
      and public.is_company_member(c.id)
  )
);

commit;

-- Resultado final: controles de estructura y definición del permiso.
-- No equivale a una prueba real de subida con la sesión de Melisa.
with counts as (
  select c.name as empresa, r.chapter as capitulo,
         count(*) filter (where r.code like '14001-%.%') as subrequisitos
  from public.companies c
  join public.sgi_requirements r on r.company_id = c.id
  where c.is_active and r.norm = 'ISO 14001' and r.is_active
  group by c.name, r.chapter
)
select 'ISO_14001' as control,
       jsonb_agg(to_jsonb(counts) order by empresa, capitulo) as resultado
from counts
union all
select 'PERMISO_SUBIDA',
       jsonb_agg(jsonb_build_object('politica', policyname, 'condicion', with_check))
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname = 'sgi_documents_insert_members';
