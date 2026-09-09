import { describe, expect, it } from 'vitest'
import { inviteCompanyUser, updateCompanyUserAccess } from './userService'

describe('user service validation', () => {
  it('rejects an unknown role before contacting Supabase', async () => {
    await expect(updateCompanyUserAccess({
      companyId: 'company-1',
      userId: 'user-1',
      role: 'owner',
      isActive: true,
    })).rejects.toThrow('Rol inválido.')
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
