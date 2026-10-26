import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSupabase } from '../lib/supabase'
import {
  COMPANY_SELECTION_KEY,
  deleteCompanyWorkspace,
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

function createDeleteMock(counts = {}, errors = {}) {
  const rpc = vi.fn().mockResolvedValue({ error: null })
  const from = vi.fn((table) => ({
    select: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({
        count: counts[table] ?? 0,
        error: errors[table] ?? null,
      }),
    })),
  }))
  return { from, rpc }
}

describe('company deletion service', () => {
  it('does not invoke deletion when the workspace has documents', async () => {
    const supabase = createDeleteMock({ documents: 7 })
    requireSupabase.mockReturnValue(supabase)
    await expect(deleteCompanyWorkspace('company-1')).rejects.toThrow('tiene documentos')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('keeps empty folders and deleted work history safe', async () => {
    const supabase = createDeleteMock({ work_entry_activity: 1 })
    requireSupabase.mockReturnValue(supabase)
    await expect(deleteCompanyWorkspace('company-2')).rejects.toThrow('historial operativo')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('fails closed when any preflight query fails', async () => {
    const supabase = createDeleteMock({}, { document_folders: { message: 'permission denied' } })
    requireSupabase.mockReturnValue(supabase)
    await expect(deleteCompanyWorkspace('company-3')).rejects.toThrow('No se pudo comprobar')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('allows the RPC only after all four content checks pass', async () => {
    const supabase = createDeleteMock()
    requireSupabase.mockReturnValue(supabase)
    await deleteCompanyWorkspace('company-4')
    expect(supabase.from).toHaveBeenCalledTimes(4)
    expect(supabase.rpc).toHaveBeenCalledWith('delete_company_workspace', {
      p_company_id: 'company-4',
    })
  })

  it('handles a backend guard that detects newly added documents', async () => {
    const supabase = createDeleteMock()
    supabase.rpc.mockResolvedValue({ error: { message: 'company_has_documents' } })
    requireSupabase.mockReturnValue(supabase)
    await expect(deleteCompanyWorkspace('company-5')).rejects.toThrow('La empresa tiene documentos')
  })
})
