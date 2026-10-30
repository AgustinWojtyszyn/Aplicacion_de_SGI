-- Privacy: public sign-in no longer enumerates every company.
-- Login/registration still resolves a single known code via get_login_company(text).
-- RLS and membership permissions remain unchanged.
revoke execute on function public.list_login_companies() from public, anon, authenticated;
