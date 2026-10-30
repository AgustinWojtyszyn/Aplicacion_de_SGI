import { describe, expect, it } from 'vitest'
import { countPendingApprovals } from './dashboardAttention'

describe('Dashboard SGI: documentos pendientes de aprobación', () => {
  it('no cuenta borradores, ni documentos que esperan revisión', () => {
    expect(countPendingApprovals([
      { status: 'draft', reviewed_at: null },
      { status: 'draft', reviewed_at: '2026-10-28T10:00:00Z' },
      { status: 'in_progress', reviewed_at: null },
      { status: 'in_progress', reviewed_at: '' },
    ])).toBe(0)
  })

  it('cuenta documentos revisados que aún están en proceso', () => {
    expect(countPendingApprovals([
      { status: 'in_progress', reviewed_at: '2026-10-29T10:00:00Z' },
      { status: 'in_progress', reviewed_at: '2026-10-30T10:00:00Z' },
      { status: 'approved', reviewed_at: '2026-10-29T10:00:00Z' },
      { status: 'draft', reviewed_at: null },
    ])).toBe(2)
  })

  it('maneja listas vacías y documentos sin fecha', () => {
    expect(countPendingApprovals()).toBe(0)
    expect(countPendingApprovals([{ status: 'in_progress' }])).toBe(0)
  })
})
