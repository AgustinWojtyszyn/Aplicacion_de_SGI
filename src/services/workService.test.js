import { describe, expect, it } from 'vitest'
import { buildWorkEntriesExcelXml, calculateWorkTotals, normalizeWorkEntry } from './workService'

describe('workService', () => {
  it('normalizes a valid work entry', () => {
    expect(normalizeWorkEntry({
      workDate: '2026-09-16',
      location: '  Planta Norte  ',
      description: '  Relevamiento  ',
      hours: '7.5',
      cost: '1000.50',
      amount: '2500',
    })).toEqual({
      work_date: '2026-09-16',
      location: 'Planta Norte',
      description: 'Relevamiento',
      hours: 7.5,
      cost: 1000.5,
      amount: 2500,
    })
  })

  it('rejects impossible hour values', () => {
    expect(() => normalizeWorkEntry({
      workDate: '2026-09-16', location: 'Planta', hours: 25, cost: 0, amount: 0,
    })).toThrow(/no superar 24/i)
  })

  it('calculates operational totals', () => {
    expect(calculateWorkTotals([
      { hours: 2.5, cost: 100, amount: 300 },
      { hours: 1.5, cost: 50, amount: 250 },
    ])).toEqual({ count: 2, hours: 4, cost: 150, amount: 550, margin: 400 })
  })

  it('builds an Excel-compatible workbook without leaking raw XML characters', () => {
    const xml = buildWorkEntriesExcelXml([
      {
        work_date: '2026-09-16',
        location: 'A&B',
        description: '<visita>',
        hours: 2,
        cost: 10,
        amount: 20,
        creator: { full_name: 'Meli & equipo' },
      },
    ], 'EP & Asociados')

    expect(xml).toContain('Excel.Sheet')
    expect(xml).toContain('A&amp;B')
    expect(xml).toContain('&lt;visita&gt;')
    expect(xml).toContain('EP &amp; Asociados')
  })
})
