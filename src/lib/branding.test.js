import { describe, expect, it } from 'vitest'
import { BRAND_NAME, BRAND_SUBTITLE, BRAND_LOGO_URL, displayCompanyName } from './branding'

describe('EP GESTIÓN visible branding', () => {
  it('has one shared name, subtitle and logo', () => {
    expect(BRAND_NAME).toBe('EP GESTIÓN')
    expect(BRAND_SUBTITLE).toBe('Sistema de Gestión')
    expect(BRAND_LOGO_URL).toBe('/ep-gestion-logo.svg')
  })
  it('shows the new name for the legacy platform company without changing its slug', () => {
    const company = { slug: 'ep-consultora', name: 'GESTIQA' }
    expect(displayCompanyName(company)).toBe(BRAND_NAME)
    expect(company.slug).toBe('ep-consultora')
    expect(company.name).toBe('GESTIQA')
  })
  it('keeps every other tenant distinct', () => {
    expect(displayCompanyName({ slug: 'andes-calingasta-srl', name: 'ANDES CALINGASTA SRL' })).toBe('ANDES CALINGASTA SRL')
    expect(displayCompanyName(null, 'Sin empresa')).toBe('Sin empresa')
  })
})
