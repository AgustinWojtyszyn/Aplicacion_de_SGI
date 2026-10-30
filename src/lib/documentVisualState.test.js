import { describe, expect, it } from 'vitest'
import { documentVisualState } from './documentVisualState'

describe('document workflow visual states', () => {
  it('does not count an untouched draft as pending approval', () => {
    expect(documentVisualState({ status: 'draft' })).toBe('draft')
  })
  it('distinguishes review waiting and approval waiting', () => {
    expect(documentVisualState({ status: 'in_progress', reviewed_at: null })).toBe('review_pending')
    expect(documentVisualState({ status: 'in_progress', reviewed_at: '2026-10-29T13:00:00Z' })).toBe('approval_pending')
  })
  it('keeps the returned and approved states separate', () => {
    expect(documentVisualState({ status: 'draft' }, true)).toBe('returned')
    expect(documentVisualState({ status: 'approved' }, true)).toBe('approved')
  })
})
