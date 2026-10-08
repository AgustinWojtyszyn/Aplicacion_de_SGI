import { describe, expect, it } from 'vitest'
import { canManageInspections, inspectionCode, normalizeSiteCode, qualityScore } from './qualityService'

describe('inspecciones BPM', () => {
  it('define códigos estables sin depender de la fábrica', () => {
    expect(inspectionCode(12)).toBe('BPM-000012')
    expect(normalizeSiteCode('Planta San Martín 2')).toBe('PLANTA-SAN-MARTIN-2')
  })
  it('separa lectura y edición sin elevar permisos', () => {
    expect(canManageInspections('member')).toBe(false)
    expect(canManageInspections('responsible')).toBe(true)
    expect(canManageInspections('admin')).toBe(true)
  })
  it('excluye No aplica del cumplimiento y cuenta los pendientes', () => {
    expect(qualityScore([
      { result: 'complies', followup_status: 'not_required' },
      { result: 'na', followup_status: 'not_required' },
      { result: 'non_complies', followup_status: 'open' },
      { result: 'partial', followup_status: 'closed' },
    ])).toEqual({
      inspected: 3, complies: 1, partial: 1, findings: 2, pending: 1, percentage: 33,
    })
  })
})
