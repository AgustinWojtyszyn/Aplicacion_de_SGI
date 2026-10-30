import { describe, expect, it } from 'vitest'
import {
  canApproveDocument, canCommentDocument, canDeleteDocument, canManageCompanies,
  canManageDocument, canManageUsers, canRejectDocument, canReviewDocument, roleLabel,
} from './permissions'

const document = {
  id: 'doc-1', created_by: 'member', responsible_id: 'member',
  reviewer_id: 'reviewer', approver_id: 'approver',
  reviewed_at: '2026-10-30T10:00:00Z', status: 'in_progress',
}

describe('final document roles', () => {
  it('reserves user and company management for administrators', () => {
    expect(canManageUsers('admin')).toBe(true)
    expect(canManageUsers('responsible')).toBe(false)
    expect(canManageUsers('member')).toBe(false)
    expect(canManageCompanies({ role: 'admin', isPlatformAdmin: true })).toBe(true)
    expect(canManageCompanies({ role: 'admin', isPlatformAdmin: false })).toBe(false)
  })
  it('restricts changes and deletion to administrators', () => {
    for (const role of ['member', 'responsible']) {
      expect(canManageDocument({ role, userId: 'member', document: { ...document, status: 'draft' } })).toBe(false)
      expect(canDeleteDocument({ role, userId: 'member', document })).toBe(false)
    }
    expect(canManageDocument({ role: 'admin', userId: 'admin', document: { ...document, status: 'draft' } })).toBe(true)
    expect(canDeleteDocument({ role: 'admin', userId: 'admin', document })).toBe(true)
  })
  it('restricts reviews, approvals, rejections and comments to assigned responsible users', () => {
    expect(canReviewDocument({ role: 'responsible', userId: 'reviewer', document })).toBe(true)
    expect(canReviewDocument({ role: 'responsible', userId: 'approver', document })).toBe(false)
    expect(canReviewDocument({ role: 'member', userId: 'reviewer', document })).toBe(false)
    expect(canApproveDocument({ role: 'responsible', userId: 'approver', document })).toBe(true)
    expect(canApproveDocument({ role: 'responsible', userId: 'reviewer', document })).toBe(false)
    expect(canApproveDocument({ role: 'member', userId: 'approver', document })).toBe(false)
    expect(canApproveDocument({ role: 'responsible', userId: 'approver', document: { ...document, reviewed_at: null } })).toBe(false)
    expect(canRejectDocument({ role: 'responsible', userId: 'reviewer', document })).toBe(true)
    expect(canRejectDocument({ role: 'member', userId: 'reviewer', document })).toBe(false)
    expect(canCommentDocument({ role: 'responsible', userId: 'approver', document })).toBe(true)
    expect(canCommentDocument({ role: 'member', userId: 'member', document })).toBe(false)
    expect(canReviewDocument({ role: 'admin', userId: 'admin', document })).toBe(true)
  })
  it('uses understandable role labels', () => {
    expect(roleLabel('admin')).toBe('Administrador')
    expect(roleLabel('responsible')).toBe('Responsable')
    expect(roleLabel('member')).toBe('Usuario')
  })
})
