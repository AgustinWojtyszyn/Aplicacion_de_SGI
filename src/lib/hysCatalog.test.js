import { describe, expect, it } from 'vitest'
import { HYS_SECTIONS, GENERAL_CATEGORIES, hysConfiguredSections } from './hysCatalog'

describe('Original HyS matrix and customized sections', () => {
  it('retains exactly the 13 sections and the six general folders', () => {
    expect(HYS_SECTIONS.map(s => s.number)).toEqual(Array.from({ length: 13 }, (_, i) => String(i + 1).padStart(2, '0')))
    expect(HYS_SECTIONS.map(s => s.categories.length)).toEqual([1, 1, 9, 4, 1, 3, 1, 2, 8, 8, 1, 1, 8])
    expect(GENERAL_CATEGORIES).toHaveLength(6)
  })
  it.each(HYS_SECTIONS)('does not inherit template folders when $code is repurposed', section => {
    const settings = [{ company_id: 'a', unit_id: 'north', code: section.code, label: 'Material de capacitación', is_active: true }]
    expect(hysConfiguredSections(settings, 'north', 'a').find(s => s.code === section.code).categories).toEqual([])
    expect(hysConfiguredSections(settings, 'south', 'a').find(s => s.code === section.code).categories).toEqual(section.categories)
    expect(hysConfiguredSections(settings, 'north', 'b').find(s => s.code === section.code).categories).toEqual(section.categories)
  })
  it('never invents Otros for a custom section', () => {
    expect(hysConfiguredSections([{ company_id: 'a', unit_id: 'north', code: 'custom_123', label: 'Personal', is_active: true }], 'north', 'a').at(-1).categories).toEqual([])
  })
})
