import { describe, expect, it } from 'vitest'
import { getCompanyDeletionBlockReason } from './companyDeletion'

describe('company deletion guard messages', () => {
  it('protects the main workspace', () => {
    expect(getCompanyDeletionBlockReason({ slug: 'ep-consultora', is_active: false })).toContain('protegido')
  })

  it('shows the archive step even when the delete icon is visible', () => {
    expect(getCompanyDeletionBlockReason({
      slug: 'empresa-uno', is_active: true, document_count: 0,
    })).toContain('Primero archivá')
  })

  it('explains the reason when company documents are present', () => {
    const message = getCompanyDeletionBlockReason({
      slug: 'parque-fotovoltaico', is_active: false, document_count: 7,
    })
    expect(message).toContain('7 documentos')
    expect(message).toContain('no se permite eliminarla')
  })

  it('only allows empty, archived, non-system workspaces to advance', () => {
    expect(getCompanyDeletionBlockReason({
      slug: 'empresa-vacia', is_active: false, document_count: 0,
    })).toBe('')
  })
})
