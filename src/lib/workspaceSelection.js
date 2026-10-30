// A company portal is a request for that exact tenant, not a request for
// whichever company the same credentials happen to belong to.
// Privileges still come exclusively from Supabase memberships/RLS.
export function selectWorkspaceCompany(companies = [], preferredCompany = null, isPlatformAdmin = false) {
  const match = preferredCompany?.slug
    ? companies.find((company) => company.slug === preferredCompany.slug)
    : null

  // Tenant users cannot fall back to a different company after logging in.
  if (preferredCompany?.slug && !isPlatformAdmin) return match ?? null
  return match ?? companies[0] ?? null
}
