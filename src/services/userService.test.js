import { describe, expect, it } from 'vitest'
import { assignExistingCompanyUser, inviteCompanyUser, updateCompanyUserAccess } from './userService'

describe('user service validation', () => {
  it('rejects an unknown role before contacting Supabase', async () => {
    await expect(updateCompanyUserAccess({
      companyId: 'company-1',
      userId: 'user-1',
      role: 'owner',
      isActive: true,
    })).rejects.toThrow('Rol inválido.')
  })

  it('validates delegated access before contacting Supabase', async () => {
    await expect(assignExistingCompanyUser({
      companyId: 'company-1',
      userId: 'user-1',
      role: 'platform_admin',
    })).rejects.toThrow('Rol inválido.')

    await expect(assignExistingCompanyUser({
      companyId: 'company-1',
      userId: '',
      role: 'admin',
    })).rejects.toThrow('Seleccioná una empresa y una persona.')
  })

  it('rejects invalid invitation roles before invoking the edge function', async () => {
    await expect(inviteCompanyUser({
      companyId: 'company-1',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'owner',
    })).rejects.toThrow('Rol inválido.')
  })
})
