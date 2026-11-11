-- GESTIQA / HyS: metadatos opcionales y deduplicación atómica de importaciones.
-- Ejecutar MANUALMENTE en SQL Editor, una sola vez. No modifica filas ni adjuntos existentes.
begin;

alter table public.hys_actions
  add column if not exists detection_date date,
  add column if not exists import_key text;

create unique index if not exists hys_actions_import_key_uniq
  on public.hys_actions (import_key)
  where import_key is not null;

comment on column public.hys_actions.detection_date is 'Fecha de detección del hallazgo importado';
comment on column public.hys_actions.import_key is 'SHA-256 estable de empresa, sede, acción y plazo para evitar reimportaciones';

commit;
