-- BPM Comedores P-07-R-06 · plantilla de la revisión solicitada el 08/10/2026.
-- Aplicar en Supabase después de revisar la discrepancia 00/01 del Excel adjunto.
begin;
create extension if not exists pgcrypto;

create table if not exists public.quality_sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  code text not null check (code ~ '^[A-Z0-9_-]{2,32}$'),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id,id),
  unique (company_id,code)
);

create table if not exists public.quality_checklist_items (
  revision integer not null,
  item_number integer not null check (item_number between 1 and 999),
  section text not null,
  question text not null,
  primary key (revision,item_number)
);
insert into public.quality_checklist_items (revision,item_number,section,question)
values
(1,1,'HIGIENE PERSONAL','Presentación personal adecuada: uniforme completo y limpio, barba rasurada, sin maquillaje, pelo atado y contenido en la cofia.'),
(1,2,'HIGIENE PERSONAL','Ausencia de accesorios personales.'),
(1,3,'HIGIENE PERSONAL','Uso de guantes descartables para alimentos listos para consumo.'),
(1,4,'HIGIENE PERSONAL','Uso de barbijo en elaboración y distribución.'),
(1,5,'HIGIENE PERSONAL','Elementos disponibles para lavado de manos.'),
(1,6,'HIGIENE PERSONAL','Lavado de manos en situaciones obligatorias.'),
(1,7,'HIGIENE PERSONAL','Medidas preventivas para colaboradores con heridas.'),
(1,8,'HIGIENE PERSONAL','No comer en áreas de elaboración.'),
(1,9,'RECEPCIÓN','Control de calidad de materias primas recibidas: envases, rótulos, vencimientos y características sensoriales.'),
(1,10,'RECEPCIÓN','Antes del almacenamiento: retirar cartón, seleccionar vegetales y frutas, etc.'),
(1,11,'ALMACENAMIENTO','Materias primas refrigeradas protegidas y rotuladas.'),
(1,12,'ALMACENAMIENTO','Alimentos listos para consumo protegidos y rotulados.'),
(1,13,'ALMACENAMIENTO','Productos secos protegidos y rotulados.'),
(1,14,'ALMACENAMIENTO','Estiba y apilamiento adecuados.'),
(1,15,'ALMACENAMIENTO','Sectorización sin riesgo de contaminación.'),
(1,16,'ALMACENAMIENTO','Mercadería ordenada; se respeta el sistema PVPS.'),
(1,17,'ALMACENAMIENTO','Descartables sectorizados y protegidos.'),
(1,18,'PRE-ELABORACIÓN Y ELABORACIÓN','Se evita la exposición prolongada de materia prima.'),
(1,19,'PRE-ELABORACIÓN Y ELABORACIÓN','Ausencia de cajas de cartón y maples de huevos.'),
(1,20,'PRE-ELABORACIÓN Y ELABORACIÓN','Áreas y etapas de producción separadas para evitar contaminación cruzada.'),
(1,21,'PRE-ELABORACIÓN Y ELABORACIÓN','Alimentos elaborados o perecederos en recipientes adecuados, protegidos, limpios y rotulados.'),
(1,22,'PRE-ELABORACIÓN Y ELABORACIÓN','Cuchillos y tablas identificados por tipo de operación.'),
(1,23,'SERVICIO / DISTRIBUCIÓN','Limpieza adecuada de equipos de servicio y distribución.'),
(1,24,'SERVICIO / DISTRIBUCIÓN','Temperatura de distribución de preparaciones calientes superior a 65 °C.'),
(1,25,'SERVICIO / DISTRIBUCIÓN','Temperatura de distribución de preparaciones frías inferior a 10 °C.'),
(1,26,'SERVICIO / DISTRIBUCIÓN','Inspección organoléptica del producto terminado.'),
(1,27,'COMEDOR','Mantenimiento de infraestructura: piso, paredes, techo, iluminación, puertas y aberturas.'),
(1,28,'COMEDOR','Mantenimiento del mobiliario: mesas, sillas, bandejas, vajilla, cubiertos y condimenteros.'),
(1,29,'COMEDOR','Limpieza de bandejas, condimenteros, servilleteros, vajilla, cubiertos, mesas y sillas.'),
(1,30,'COMEDOR','Limpieza del espacio físico.'),
(1,31,'COMEDOR','Decoración y orden adecuados.'),
(1,32,'BAÑOS Y VESTUARIOS','Limpieza, mantenimiento y conservación adecuados de baños y vestuarios.'),
(1,33,'POES','Provisión de agua caliente.'),
(1,34,'POES','Almacenamiento correcto de utensilios y vajilla.'),
(1,35,'POES','Lavado y desinfección correctos de utensilios, vajilla y equipos.'),
(1,36,'POES','Recipientes de residuos con tapa, limpios por dentro y por fuera.'),
(1,37,'POES','Productos de limpieza identificados y almacenados separados de la elaboración.'),
(1,38,'MANEJO INTEGRADO DE PLAGAS','Sistemas de exclusión apropiados.'),
(1,39,'MANEJO INTEGRADO DE PLAGAS','Ausencia de plagas en el interior del establecimiento.'),
(1,40,'MANEJO INTEGRADO DE PLAGAS','Presencia y/o evidencia de plagas (evaluar según criterio del procedimiento).'),
(1,41,'MANEJO INTEGRADO DE PLAGAS','Registro completo de servicios.'),
(1,42,'MANTENIMIENTO','Condiciones adecuadas de equipos.'),
(1,43,'MANTENIMIENTO','Condiciones adecuadas de elementos.'),
(1,44,'REGISTROS','Registro del control de temperatura de equipos de frío.'),
(1,45,'REGISTROS','Registro de temperatura de regeneración de preparaciones.'),
(1,46,'REGISTROS','Registro de temperatura de distribución de preparaciones.'),
(1,47,'REGISTROS','Cronograma de limpieza.'),
(1,48,'REGISTROS','Cartelería correspondiente visible.'),
(1,49,'REGISTROS','Otros controles (49).'),
(1,50,'REGISTROS','Otros controles (50).')
on conflict (revision,item_number) do nothing;

create table if not exists public.quality_inspections (
  id uuid primary key default gen_random_uuid(),
  inspection_number bigint generated always as identity unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid not null,
  checklist_revision integer not null default 1 check (checklist_revision = 1),
  inspection_date date not null default current_date,
  previous_inspection_date date,
  start_time time,
  end_time time,
  inspector_name text not null check (length(trim(inspector_name)) between 2 and 160),
  notes text check (notes is null or length(notes) <= 3000),
  status text not null default 'draft' check (status in ('draft','closed')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  foreign key (company_id,site_id) references public.quality_sites(company_id,id),
  unique (company_id,id)
);
create index if not exists quality_inspections_site_date_idx
  on public.quality_inspections(company_id,site_id,inspection_date desc);

create table if not exists public.quality_inspection_answers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inspection_id uuid not null,
  checklist_revision integer not null default 1,
  item_number integer not null,
  result text not null check (result in ('complies','non_complies','partial','na')),
  comments text check (comments is null or length(comments) <= 3000),
  corrective_action text check (corrective_action is null or length(corrective_action) <= 3000),
  followup_status text not null default 'not_required'
    check (followup_status in ('not_required','open','in_progress','closed')),
  due_date date,
  evidence_before text,
  evidence_after text,
  updated_by uuid not null default auth.uid() references public.profiles(id),
  updated_at timestamptz not null default now(),
  foreign key (company_id,inspection_id) references public.quality_inspections(company_id,id) on delete cascade,
  foreign key (checklist_revision,item_number) references public.quality_checklist_items(revision,item_number),
  unique (inspection_id,item_number),
  check (
    (result in ('complies','na') and followup_status = 'not_required')
    or (result in ('non_complies','partial') and followup_status in ('open','in_progress','closed'))
  ),
  check (followup_status <> 'closed' or nullif(trim(coalesce(corrective_action,'')),'') is not null)
);
create index if not exists quality_answers_followup_idx
  on public.quality_inspection_answers(company_id,followup_status,due_date)
  where followup_status <> 'not_required';

create table if not exists public.quality_inspection_activity (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  inspection_id uuid not null,
  actor_id uuid references public.profiles(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists quality_inspection_activity_company_idx
  on public.quality_inspection_activity(company_id,created_at desc);

create or replace function public.quality_guard_site()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id or new.created_by is distinct from old.created_by
      then raise exception 'quality_site_identity_immutable'; end if;
  else
    new.created_by := auth.uid();
  end if;
  new.name := trim(new.name);
  new.code := upper(trim(new.code));
  return new;
end $$;
drop trigger if exists quality_sites_guard on public.quality_sites;
create trigger quality_sites_guard before insert or update on public.quality_sites
for each row execute function public.quality_guard_site();

create or replace function public.quality_guard_inspection()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_total integer;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    if new.company_id is distinct from old.company_id
      or new.site_id is distinct from old.site_id
      or new.created_by is distinct from old.created_by
      or new.checklist_revision is distinct from old.checklist_revision
      then raise exception 'quality_inspection_identity_immutable'; end if;
    if old.status = 'closed' and
      (new.inspection_date,new.previous_inspection_date,new.start_time,new.end_time,new.inspector_name,new.notes,new.status)
      is distinct from
      (old.inspection_date,old.previous_inspection_date,old.start_time,old.end_time,old.inspector_name,old.notes,old.status)
      then raise exception 'quality_inspection_closed'; end if;
    if old.status = 'draft' and new.status = 'closed' then
      select count(*) into v_total from public.quality_inspection_answers a where a.inspection_id = old.id;
      if v_total <> (select count(*) from public.quality_checklist_items where revision = old.checklist_revision)
        then raise exception 'quality_checklist_incomplete'; end if;
      new.closed_at := now();
    end if;
  end if;
  new.inspector_name := trim(new.inspector_name);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists quality_inspections_guard on public.quality_inspections;
create trigger quality_inspections_guard before insert or update on public.quality_inspections
for each row execute function public.quality_guard_inspection();

create or replace function public.quality_guard_answer()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_inspection public.quality_inspections%rowtype;
begin
  select * into v_inspection from public.quality_inspections where id = new.inspection_id;
  if not found then raise exception 'quality_inspection_not_found'; end if;
  if new.company_id <> v_inspection.company_id or new.checklist_revision <> v_inspection.checklist_revision
    then raise exception 'quality_answer_scope_mismatch'; end if;
  if tg_op = 'INSERT' then
    if v_inspection.status <> 'draft' then raise exception 'quality_inspection_closed'; end if;
  else
    if new.company_id is distinct from old.company_id
      or new.inspection_id is distinct from old.inspection_id
      or new.checklist_revision is distinct from old.checklist_revision
      or new.item_number is distinct from old.item_number
      then raise exception 'quality_answer_identity_immutable'; end if;
    if v_inspection.status = 'closed' and
      (new.result,new.comments) is distinct from (old.result,old.comments)
      then raise exception 'quality_original_finding_is_locked'; end if;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists quality_answers_guard on public.quality_inspection_answers;
create trigger quality_answers_guard before insert or update on public.quality_inspection_answers
for each row execute function public.quality_guard_answer();

create or replace function public.quality_log_activity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid; v_inspection uuid;
begin
  v_company := new.company_id;
  v_inspection := case when tg_table_name = 'quality_inspections' then new.id else new.inspection_id end;
  insert into public.quality_inspection_activity(company_id,inspection_id,actor_id,action,details)
  values (v_company,v_inspection,auth.uid(),tg_table_name || '_' || lower(tg_op),
    jsonb_build_object('before', case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
                       'after',to_jsonb(new)));
  return new;
end $$;
drop trigger if exists quality_inspections_audit on public.quality_inspections;
create trigger quality_inspections_audit after insert or update on public.quality_inspections
for each row execute function public.quality_log_activity();
drop trigger if exists quality_answers_audit on public.quality_inspection_answers;
create trigger quality_answers_audit after insert or update on public.quality_inspection_answers
for each row execute function public.quality_log_activity();

alter table public.quality_sites enable row level security;
alter table public.quality_checklist_items enable row level security;
alter table public.quality_inspections enable row level security;
alter table public.quality_inspection_answers enable row level security;
alter table public.quality_inspection_activity enable row level security;

create policy quality_sites_read on public.quality_sites for select to authenticated
  using (public.is_company_member(company_id));
create policy quality_sites_write on public.quality_sites for insert to authenticated
  with check (public.has_company_role(company_id,array['admin'::public.company_role,'responsible'::public.company_role]) and created_by=auth.uid());
create policy quality_sites_edit on public.quality_sites for update to authenticated
  using (public.has_company_role(company_id,array['admin'::public.company_role,'responsible'::public.company_role]))
  with check (public.has_company_role(company_id,array['admin'::public.company_role,'responsible'::public.company_role]));
create policy quality_templates_read on public.quality_checklist_items for select to authenticated
  using (true);
create policy quality_inspections_read on public.quality_inspections for select to authenticated
  using (public.is_company_member(company_id));
create policy quality_inspections_write on public.quality_inspections for insert to authenticated
  with check (public.has_company_role(company_id,array['admin'::public.company_role,'responsible'::public.company_role]) and created_by=auth.uid());
create policy quality_inspections_edit on public.quality_inspections for update to authenticated
  using (public.has_company_role(company_id,array['admin'::public.company_role,'responsible'::public.company_role]))
  with check (public.has_company_role(company_id,array['admin'::public.company_role,'responsible'::public.company_role]));
create policy quality_answers_read on public.quality_inspection_answers for select to authenticated
  using (public.is_company_member(company_id));
create policy quality_answers_write on public.quality_inspection_answers for insert to authenticated
  with check (public.has_company_role(company_id,array['admin'::public.company_role,'responsible'::public.company_role]) and updated_by=auth.uid());
create policy quality_answers_edit on public.quality_inspection_answers for update to authenticated
  using (public.has_company_role(company_id,array['admin'::public.company_role,'responsible'::public.company_role]))
  with check (public.has_company_role(company_id,array['admin'::public.company_role,'responsible'::public.company_role]));
create policy quality_activity_read on public.quality_inspection_activity for select to authenticated
  using (public.is_company_member(company_id));

grant select on public.quality_sites,public.quality_checklist_items,public.quality_inspections,
  public.quality_inspection_answers,public.quality_inspection_activity to authenticated;
grant insert,update on public.quality_sites,public.quality_inspections,public.quality_inspection_answers to authenticated;
grant usage,select on all sequences in schema public to authenticated;
revoke all on public.quality_inspection_activity from anon,public;
revoke insert,update,delete on public.quality_inspection_activity from authenticated;

-- Bucket privado, sin enlaces públicos y con fotografías limitadas a miembros habilitados.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('quality-evidence','quality-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy quality_evidence_read on storage.objects for select to authenticated using (
  bucket_id='quality-evidence' and public.is_company_member(public.safe_storage_company_id(name))
);
create policy quality_evidence_upload on storage.objects for insert to authenticated with check (
  bucket_id='quality-evidence'
  and public.has_company_role(public.safe_storage_company_id(name),array['admin'::public.company_role,'responsible'::public.company_role])
);
commit;
