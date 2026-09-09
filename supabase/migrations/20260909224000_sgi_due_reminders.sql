begin;

create or replace function public.generate_sgi_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.sgi_notifications (
    company_id,
    user_id,
    document_id,
    kind,
    title,
    message
  )
  select
    d.company_id,
    recipient.user_id,
    d.id,
    case
      when d.review_due_at < now() then 'review_overdue'
      else 'review_due_soon'
    end,
    case
      when d.review_due_at < now() then 'Documento vencido'
      else 'Revisión próxima a vencer'
    end,
    case
      when d.review_due_at < now() then
        d.title || ' superó su fecha objetivo de revisión (' || to_char(d.review_due_at, 'DD/MM/YYYY') || ').'
      else
        d.title || ' vence el ' || to_char(d.review_due_at, 'DD/MM/YYYY') || '.'
    end
  from public.documents d
  cross join lateral (
    select distinct candidates.user_id
    from (
      values (d.responsible_id), (d.reviewer_id), (d.approver_id)
    ) as candidates(user_id)
    where candidates.user_id is not null
      and public.is_company_member(d.company_id, candidates.user_id)

    union

    select cm.user_id
    from public.company_members cm
    where cm.company_id = d.company_id
      and cm.is_active = true
      and cm.role = 'admin'::public.company_role
  ) recipient
  where d.status <> 'approved'
    and d.review_due_at is not null
    and d.review_due_at <= now() + interval '7 days'
    and not exists (
      select 1
      from public.sgi_notifications existing
      where existing.document_id = d.id
        and existing.user_id = recipient.user_id
        and existing.kind = case
          when d.review_due_at < now() then 'review_overdue'
          else 'review_due_soon'
        end
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.generate_sgi_due_notifications() from public;
revoke all on function public.generate_sgi_due_notifications() from anon;
revoke all on function public.generate_sgi_due_notifications() from authenticated;
grant execute on function public.generate_sgi_due_notifications() to service_role;

-- Supabase Cron / pg_cron. If the extension is not available in the environment,
-- the function above still exists and can be scheduled from the Supabase Cron UI.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when others then
      raise notice 'pg_cron could not be enabled automatically: %', sqlerrm;
  end;

  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'integraflow-sgi-due-reminders';

    perform cron.schedule(
      'integraflow-sgi-due-reminders',
      '0 12 * * *',
      $cron$select public.generate_sgi_due_notifications();$cron$
    );
  else
    raise notice 'Cron schema unavailable. Schedule public.generate_sgi_due_notifications() daily from Supabase Cron.';
  end if;
end $$;

-- Generate any reminders that already qualify at migration time.
select public.generate_sgi_due_notifications();

commit;
