import { beforeEach, describe, expect, it } from 'vitest'
import {
  COMPANY_SELECTION_KEY,
  readSelectedCompany,
  rememberSelectedCompany,
  slugifyCompanyName,
} from './tenantService'

beforeEach(() => {
  window.localStorage.clear()
})

describe('tenant selection helpers', () => {
  it('creates stable company slugs from display names', () => {
    expect(slugifyCompanyName('Empresa Ándina S.A.')).toBe('empresa-andina-s-a')
    expect(slugifyCompanyName('  Minera  del Sur  ')).toBe('minera-del-sur')
  })

  it('persists the selected company without extra data', () => {
    rememberSelectedCompany({
      id: 'company-1',
      name: 'Empresa Andina',
      slug: 'empresa-andina',
      secret: 'must-not-be-stored',
    })

    expect(readSelectedCompany()).toEqual({
      id: 'company-1',
      name: 'Empresa Andina',
      slug: 'empresa-andina',
    })
  })

  it('returns null for corrupted or incomplete persisted selections', () => {
    window.localStorage.setItem(COMPANY_SELECTION_KEY, '{broken')
    expect(readSelectedCompany()).toBeNull()

    window.localStorage.setItem(COMPANY_SELECTION_KEY, JSON.stringify({ name: 'Sin slug' }))
    expect(readSelectedCompany()).toBeNull()
  })
})
