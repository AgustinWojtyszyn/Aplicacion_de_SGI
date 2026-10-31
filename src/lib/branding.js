/** Visual product name only: retain immutable company slugs and server-side names for compatibility. */
export const BRAND_NAME = 'EP GESTIÓN'
export const BRAND_SUBTITLE = 'Sistemas de Gestión Integrados'
export const BRAND_LOGO_URL = '/ep-gestion-logo.svg'

export function displayCompanyName(company, fallback = '') {
  if (!company) return fallback
  const slug = String(company.slug || '').toLowerCase()
  const name = String(company.name || '')
  if (slug === 'ep-consultora' || slug === 'gestiqa' || name.toLowerCase() === 'gestiqa') return BRAND_NAME
  return name || fallback
}
