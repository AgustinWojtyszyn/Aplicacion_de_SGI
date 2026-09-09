begin;

create or replace function public.get_sgi_dashboard_metrics(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_company_member(p_company_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;

  with company_docs as (
    select d.*
    from public.documents d
    where d.company_id = p_company_id
  ),
  workflow_counts as (
    select
      count(*) filter (where a.action = 'submitted_for_review')::numeric as submissions,
      count(*) filter (where a.action = 'reviewed')::numeric as reviews,
      count(*) filter (where a.action = 'approved')::numeric as approvals
    from public.document_activity a
    join company_docs d on d.id = a.document_id
  ),
  observed_documents as (
    select count(distinct a.document_id)::numeric as observed
    from public.document_activity a
    join company_docs d on d.id = a.document_id
    where a.action = 'rejected'
  ),
  submitted_documents as (
    select count(distinct a.document_id)::numeric as submitted
    from public.document_activity a
    join company_docs d on d.id = a.document_id
    where a.action = 'submitted_for_review'
  ),
  notification_counts as (
    select
      count(*)::numeric as total,
      count(*) filter (where n.read_at is not null)::numeric as handled
    from public.sgi_notifications n
    where n.company_id = p_company_id
  )
  select jsonb_build_object(
    'total_documents', count(*)::int,
    'draft_documents', count(*) filter (where d.status = 'draft')::int,
    'in_progress_documents', count(*) filter (where d.status = 'in_progress')::int,
    'approved_documents', count(*) filter (where d.status = 'approved')::int,
    'avg_approval_days', coalesce(
      round(avg(extract(epoch from (d.approved_at - d.submitted_for_review_at)) / 86400.0)
        filter (where d.approved_at is not null and d.submitted_for_review_at is not null), 1),
      0
    ),
    'observation_rate', coalesce(round(100.0 * od.observed / nullif(sd.submitted, 0), 1), 0),
    'on_time_approval_rate', coalesce(
      round(
        100.0 * count(*) filter (
          where d.status = 'approved'
            and d.review_due_at is not null
            and d.approved_at is not null
            and d.approved_at <= d.review_due_at
        )
        / nullif(count(*) filter (where d.status = 'approved' and d.review_due_at is not null), 0),
        1
      ),
      0
    ),
    'reviewer_response_rate', coalesce(round(100.0 * wc.reviews / nullif(wc.submissions, 0), 1), 0),
    'approver_response_rate', coalesce(round(100.0 * wc.approvals / nullif(wc.reviews, 0), 1), 0),
    'avg_versions_before_approval', coalesce(
      round(avg(d.current_version::numeric) filter (where d.status = 'approved'), 1),
      0
    ),
    'alert_handled_rate', coalesce(round(100.0 * nc.handled / nullif(nc.total, 0), 1), 0),
    'alerts_total', nc.total::int
  ) into v_result
  from company_docs d
  cross join workflow_counts wc
  cross join observed_documents od
  cross join submitted_documents sd
  cross join notification_counts nc
  group by wc.submissions, wc.reviews, wc.approvals, od.observed, sd.submitted, nc.total, nc.handled;

  return coalesce(v_result, jsonb_build_object(
    'total_documents', 0,
    'draft_documents', 0,
    'in_progress_documents', 0,
    'approved_documents', 0,
    'avg_approval_days', 0,
    'observation_rate', 0,
    'on_time_approval_rate', 0,
    'reviewer_response_rate', 0,
    'approver_response_rate', 0,
    'avg_versions_before_approval', 0,
    'alert_handled_rate', 0,
    'alerts_total', 0
  ));
end;
$$;

revoke all on function public.get_sgi_dashboard_metrics(uuid) from public;
grant execute on function public.get_sgi_dashboard_metrics(uuid) to authenticated;

commit;
