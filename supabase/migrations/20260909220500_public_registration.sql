begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_company_slug text;
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  v_company_slug := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_slug', '')), '');

  if v_company_slug is not null then
    select id
      into v_company_id
    from public.companies
    where slug = v_company_slug
    limit 1;

    if v_company_id is not null then
      insert into public.company_members (company_id, user_id, role, is_active)
      values (v_company_id, new.id, 'member', false)
      on conflict (company_id, user_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

commit;
