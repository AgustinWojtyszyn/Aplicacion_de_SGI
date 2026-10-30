import { describe, expect, it } from 'vitest'
import { getCompanyDeletionBlockReason } from './companyDeletion'

describe('company deletion guard', () => {
  it('protects the main workspace', () => {
    expect(getCompanyDeletionBlockReason({ slug: 'ep-consultora', is_active: true })).toContain('protegido')
  })

  it('allows direct deletion of active companies with documents', () => {
    expect(getCompanyDeletionBlockReason({
      slug: 'empresa-activa', is_active: true, document_count: 14,
    })).toBe('')
  })

  it('allows deletion of archived companies with historical records', () => {
    expect(getCompanyDeletionBlockReason({
      slug: 'empresa-archivada', is_active: false, document_count: 3,
    })).toBe('')
  })

  it('does not allow a missing company', () => {
    expect(getCompanyDeletionBlockReason(null)).toContain('no disponible')
  })
})
