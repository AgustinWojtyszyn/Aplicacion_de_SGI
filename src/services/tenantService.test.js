import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSupabase } from '../lib/supabase'
import {
  COMPANY_SELECTION_KEY,
  deleteCompanyWorkspace,
  findCompanyBySlug,
  readSelectedCompany,
  rememberSelectedCompany,
  slugifyCompanyName,
} from './tenantService'

vi.mock('../lib/supabase', () => ({ requireSupabase: vi.fn() }))

beforeEach(() => {
  window.localStorage.clear()
  vi.clearAllMocks()
})

describe('tenant selection helpers', () => {
  it('creates stable company slugs from display names', () => {
    expect(slugifyCompanyName('Empresa Ándina S.A.')).toBe('empresa-andina-s-a')
    expect(slugifyCompanyName('  Minera  del Sur  ')).toBe('minera-del-sur')
  })

  it('detects archived and active slugs while allowing deleted names', () => {
    const companies = [
      { id: 'old-1', slug: 'parque-fotovoltaico-cutral-co-mun', is_active: false },
      { id: 'active-1', slug: 'empresa-andina', is_active: true },
    ]
    expect(findCompanyBySlug(companies, ' PARQUE-FOTOVOLTAICO-CUTRAL-CO-MUN ')).toEqual(companies[0])
    expect(findCompanyBySlug(companies, 'empresa-andina')).toEqual(companies[1])
    expect(findCompanyBySlug(companies, 'empresa-eliminada')).toBeNull()
    expect(findCompanyBySlug(companies, '')).toBeNull()
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

describe('company deletion through the secured Edge Function', () => {
  it('can delete an active company with documents without frontend table preflights', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { completed: true, jobId: 'job-1' }, error: null })
    requireSupabase.mockReturnValue({ functions: { invoke } })
    await expect(deleteCompanyWorkspace('company-1', 'Empresa Andina')).resolves.toEqual({
      completed: true, jobId: 'job-1',
    })
    expect(invoke).toHaveBeenCalledWith('delete-company', {
      body: { action: 'delete', companyId: 'company-1', companyName: 'Empresa Andina' },
    })
  })

  it('reports incomplete Storage cleanup without pretending success', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { completed: false, jobId: 'job-pending' }, error: null })
    requireSupabase.mockReturnValue({ functions: { invoke } })
    await expect(deleteCompanyWorkspace('company-2', 'Empresa con documentos')).resolves.toEqual({
      completed: false, jobId: 'job-pending',
    })
  })

  it('translates backend protection failures to friendly messages', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { error: 'system_company_cannot_be_deleted' }, error: null,
    })
    requireSupabase.mockReturnValue({ functions: { invoke } })
    await expect(deleteCompanyWorkspace('company-main', 'EP Consultora')).rejects.toThrow('protegido')
  })

  it('does not accept success without a cleanup job id', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { completed: true }, error: null })
    requireSupabase.mockReturnValue({ functions: { invoke } })
    await expect(deleteCompanyWorkspace('company-3', 'Empresa')).rejects.toThrow('respuesta incompleta')
  })
})
