import { describe, expect, it } from 'vitest'
import { HYS_SECTIONS } from '../lib/hysCatalog'
import { buildActionsExcel, canUseHys, normalizeHysAction } from './hysService'

describe('Higiene y Seguridad', () => {
  it('preserves the thirteen sections requested by the client', () => {
    expect(HYS_SECTIONS.map((s) => s.number)).toEqual(
      Array.from({ length: 13 }, (_, i) => String(i + 1).padStart(2, '0')),
    )
    expect(HYS_SECTIONS.find((s) => s.number === '03').categories).toContain('03.06 Accidentes de trabajo')
  })

  it('normalizes and validates action inputs', () => {
    expect(normalizeHysAction({
      title: '  Instalar señalización  ', description: '  Cocina norte ',
      responsible: '  Técnica HyS ', priority: 'alta', status: 'en_curso', due_date: '',
    })).toEqual({
      title: 'Instalar señalización', description: 'Cocina norte',
      responsible: 'Técnica HyS', priority: 'alta', status: 'en_curso', due_date: null,
    })
    expect(() => normalizeHysAction({
      title: 'ok', priority: 'alta', status: 'pendiente',
    })).toThrow(/entre 3 y 180/)
    expect(() => normalizeHysAction({
      title: 'Revisar matafuegos', priority: 'superior', status: 'pendiente',
    })).toThrow(/Prioridad inválida/)
  })

  it('restricts a unit grant to its section and unit, including in edit mode', () => {
    const grants = [{ section: 'actions', unit_id: 'cocina-a', permission: 'edit' }]
    const opts = { isAdmin: false, grants }
    expect(canUseHys({ ...opts, section: 'actions', unitId: 'cocina-a', write: true })).toBe(true)
    expect(canUseHys({ ...opts, section: 'actions', unitId: 'cocina-b', write: true })).toBe(false)
    expect(canUseHys({ ...opts, section: 'general', unitId: null, write: false })).toBe(false)
    expect(canUseHys({ ...opts, section: 'actions', unitId: null, write: false })).toBe(false)
  })

  it('permits company-wide reading but blocks editing without an edit grant', () => {
    const grants = [{ section: 'actions', unit_id: null, permission: 'read' }]
    expect(canUseHys({ grants, isAdmin: false, section: 'actions', unitId: 'cocina-b' })).toBe(true)
    expect(canUseHys({ grants, isAdmin: false, section: 'actions', unitId: 'cocina-b', write: true })).toBe(false)
    expect(canUseHys({ grants, isAdmin: true, section: 'legal', unitId: 'cocina-b', write: true })).toBe(true)
  })

  it('generates an Excel-compatible workbook and escapes user content', () => {
    const xml = buildActionsExcel([{ title: 'A&B <C>', description: 'Revisar > 10', status: 'pendiente',
      priority: 'media', responsible: 'Melisa', due_date: '', unit_id: 'cocina-a' }], () => 'Sede A')
    expect(xml).toContain('A&amp;B &lt;C&gt;')
    expect(xml).toContain('Revisar &gt; 10')
    expect(xml).toContain('Sede A')
    expect(xml).not.toContain('A&B <C>')
  })
})
