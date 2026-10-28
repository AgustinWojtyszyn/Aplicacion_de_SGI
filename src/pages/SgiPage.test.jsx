import { describe, expect, it } from 'vitest'
import { getChapters } from './SgiPage'

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
    expect(chapters[0].requirements.map((item) => item.code)).toEqual(['9001-4.1', '9001-4.2'])
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
