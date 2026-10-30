import { describe, expect, it } from 'vitest'
import { getChapters, nextDocumentAction } from './SgiPage'

const requirements = [
  { id: 'root', norm: 'ISO 9001', chapter: 4, code: '9001-4', title: 'Contexto', description: 'Capítulo 4' },
  { id: 'other', norm: 'ISO 14001', chapter: 4, code: '14001-4', title: 'Ambiente' },
]
const approved = (id, requirement_id) => ({ id, requirement_id, status: 'approved' })
const draft = (id, requirement_id) => ({ id, requirement_id, status: 'draft' })

describe('SGI unified chapter view', () => {
  it('represents an existing chapter once and preserves its original document progress', () => {
    const chapters = getChapters('ISO 9001', requirements, [approved('a', 'root')])
    expect(chapters).toHaveLength(1)
    expect(chapters[0]).toMatchObject({
      chapter: '4', total: 1, covered: 1, approved: 1, percent: 100,
    })
  })

  it('uses detailed clauses for coverage without counting the legacy chapter root twice', () => {
    const detailed = [
      ...requirements,
      { id: 'clause1', norm: 'ISO 9001', chapter: 4, code: '9001-4.1', title: 'Contexto' },
      { id: 'clause2', norm: 'ISO 9001', chapter: 4, code: '9001-4.2', title: 'Partes interesadas' },
    ]
    const chapters = getChapters('ISO 9001', detailed, [
      approved('old', 'root'), approved('new', 'clause1'), draft('pending', 'clause2'),
    ])
    expect(chapters[0].total).toBe(2)
    expect(chapters[0].covered).toBe(1)
    expect(chapters[0].percent).toBe(50)
    expect(chapters[0].documents).toHaveLength(3)
    expect(chapters[0].legacyRoot.id).toBe('root')
    expect(chapters[0].historicApproved).toBe(1)
    expect(chapters[0].requirements.map((item) => item.code)).toEqual(['9001-4.1', '9001-4.2'])
  })

  it('orders ISO 14001 nested clauses and keeps legacy documents visible', () => {
    const environmental = [
      { id: 'environment-root', norm: 'ISO 14001', chapter: 6, code: '14001-6', title: 'Planificación' },
      { id: 'c10', norm: 'ISO 14001', chapter: 6, code: '14001-6.1.10', title: 'Apartado adicional' },
      { id: 'c2', norm: 'ISO 14001', chapter: 6, code: '14001-6.1.2', title: 'Aspectos ambientales' },
      { id: 'c1', norm: 'ISO 14001', chapter: 6, code: '14001-6.1.1', title: 'Riesgos y oportunidades' },
      { id: 'objective', norm: 'ISO 14001', chapter: 6, code: '14001-6.2.1', title: 'Objetivos ambientales' },
    ]
    const chapters = getChapters('ISO 14001', environmental, [
      approved('historic', 'environment-root'), approved('environmental', 'c2'),
    ])
    expect(chapters).toHaveLength(1)
    expect(chapters[0].requirements.map(({ code }) => code)).toEqual([
      '14001-6.1.1', '14001-6.1.2', '14001-6.1.10', '14001-6.2.1',
    ])
    expect(chapters[0]).toMatchObject({
      total: 4, covered: 1, percent: 25, historicApproved: 1,
    })
    expect(chapters[0].documents).toHaveLength(2)
  })

  it('keeps norms isolated and correctly reports empty coverage', () => {
    expect(getChapters('ISO 14001', requirements, [approved('x', 'root')])[0].percent).toBe(0)
    expect(getChapters('ISO 45001', requirements, [])).toEqual([])
  })

  it('orders chapters and requirement codes numerically', () => {
    const extra = [
      { id: 'a', norm: 'ISO 9001', chapter: 10, code: '9001-10', title: 'Mejora' },
      { id: 'b', norm: 'ISO 9001', chapter: 4, code: '9001-4.10', title: 'Otro' },
      { id: 'c', norm: 'ISO 9001', chapter: 4, code: '9001-4.2', title: 'Segundo' },
    ]
    const chapters = getChapters('ISO 9001', [...requirements, ...extra], [])
    expect(chapters.map((item) => item.chapter)).toEqual(['4', '10'])
    expect(chapters[0].requirements.map((item) => item.code)).toEqual(['9001-4.2', '9001-4.10'])
  })
})


describe('SGI detail and follow-up regression checks', () => {
  const now = new Date('2026-10-28T15:00:00.000Z')

  it('does not invent historical roots when only clauses exist', () => {
    const chapters = getChapters('ISO 9001', [
      { id: 'clause', norm: 'ISO 9001', chapter: 4, code: '9001-4.1', title: 'Contexto' },
    ], [approved('current', 'clause')])
    expect(chapters[0].legacyRoot).toBeNull()
    expect(chapters[0].historicApproved).toBe(0)
    expect(chapters[0].percent).toBe(100)
  })

  it('distinguishes draft, returned, review and approval work', () => {
    expect(nextDocumentAction({ status: 'draft' }, now).label).toBe('Preparar y enviar a revisión')
    expect(nextDocumentAction({ status: 'draft' }, now, true).label).toBe('Corregir observaciones y reenviar')
    expect(nextDocumentAction({ status: 'in_progress', reviewed_at: null }, now).label).toBe('Pendiente de revisión')
    expect(nextDocumentAction({ status: 'in_progress', reviewed_at: '2026-10-27' }, now).label).toBe('Pendiente de aprobación')
    expect(nextDocumentAction({ status: 'approved' }, now)).toBeNull()
  })

  it('marks overdue work without false alarms for upcoming tasks', () => {
    expect(nextDocumentAction({ status: 'draft', review_due_at: '2026-10-20' }, now).overdue).toBe(true)
    expect(nextDocumentAction({ status: 'draft', review_due_at: '2026-11-01' }, now).overdue).toBe(false)
    expect(nextDocumentAction({ status: 'draft', review_due_at: null }, now).overdue).toBe(false)
  })

  it('never transfers coverage between norms or other chapters', () => {
    const chapters = getChapters('ISO 9001', [
      { id: '9001-4', norm: 'ISO 9001', chapter: 4, code: '9001-4', title: 'Contexto' },
      { id: '9001-5', norm: 'ISO 9001', chapter: 5, code: '9001-5', title: 'Liderazgo' },
      { id: '14001-4', norm: 'ISO 14001', chapter: 4, code: '14001-4', title: 'Ambiente' },
    ], [approved('other', '14001-4'), draft('draft', '9001-5')])
    expect(chapters).toHaveLength(2)
    expect(chapters.every((chapter) => chapter.percent === 0)).toBe(true)
  })
})
