begin;

-- ISO 14001: la misma navegación por cláusulas que ISO 9001, con contenido ambiental.
-- No se alteran requisitos existentes, documentos, aprobaciones, evaluaciones ni permisos.
-- Solo se completan capítulos ambientales existentes y activos en cada empresa.
insert into public.sgi_requirements (company_id, norm, chapter, code, title, description)
select parent.company_id, 'ISO 14001', detail.chapter, detail.code, detail.title, detail.description
from (
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
join public.sgi_requirements parent
  on parent.norm = 'ISO 14001'
 and parent.chapter = detail.chapter
 and parent.code = '14001-' || detail.chapter::text
 and parent.is_active
on conflict (company_id, norm, code) do nothing;

commit;

-- Control: comprobar que cada empresa con ISO 14001 tenga el desglose por capítulo.
select c.name as empresa, r.chapter as capitulo,
       count(*) filter (where r.code like '14001-%.%') as subrequisitos,
       count(*) filter (where r.code = '14001-' || r.chapter::text) as carpeta_general
from public.sgi_requirements r
join public.companies c on c.id = r.company_id
where r.norm = 'ISO 14001' and r.is_active
group by c.name, r.chapter
order by c.name, r.chapter;

