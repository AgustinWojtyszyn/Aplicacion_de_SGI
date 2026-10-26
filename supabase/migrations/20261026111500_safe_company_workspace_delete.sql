-- La eliminación debe ser explícita, solo para admins globales y sin pérdida
-- de documentos, carpetas o historial operativo del cliente.
begin;

create or replace function public.delete_company_workspace(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_slug text;
  v_is_active boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_platform_admin(auth.uid()) then
    raise exception 'not_authorized';
  end if;

  -- El bloqueo de la fila evita inserciones de datos asociados durante
  -- la comprobación de dependencias y el borrado.
  select c.slug, c.is_active
    into v_slug, v_is_active
  from public.companies c
  where c.id = p_company_id
  for update;

  if v_slug is null then
    raise exception 'company_not_found';
  end if;

  if v_slug = 'ep-consultora' then
    raise exception 'system_company_cannot_be_deleted';
  end if;

  if v_is_active then
    raise exception 'company_must_be_archived_before_delete';
  end if;

  if exists (select 1 from public.documents where company_id = p_company_id) then
    raise exception 'company_has_documents';
  end if;

  if exists (select 1 from public.document_folders where company_id = p_company_id) then
    raise exception 'company_has_folders';
  end if;

  if exists (select 1 from public.work_entries where company_id = p_company_id)
    or exists (select 1 from public.work_entry_activity where company_id = p_company_id)
  then
    raise exception 'company_has_work_history';
  end if;

  -- Solo se eliminan espacios vacíos; usuarios y perfiles se conservan.
  delete from public.companies where id = p_company_id;
end;
$function$;

revoke all on function public.delete_company_workspace(uuid) from public, anon, authenticated;
grant execute on function public.delete_company_workspace(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
