import { describe, expect, it } from 'vitest'
import {
  canDeleteDocument,
  canManageDocument,
  canManageUsers,
  roleLabel,
} from './permissions'

const otherDocument = {
  id: 'doc-1',
  created_by: 'creator-1',
  responsible_id: 'responsible-1',
  status: 'draft',
}

describe('role permissions', () => {
  it('reserves user administration for admins', () => {
    expect(canManageUsers('admin')).toBe(true)
    expect(canManageUsers('responsible')).toBe(false)
    expect(canManageUsers('member')).toBe(false)
  })

  it('lets admins and responsible roles manage any company document', () => {
    expect(canManageDocument({ role: 'admin', userId: 'user-1', document: otherDocument })).toBe(true)
    expect(canManageDocument({ role: 'responsible', userId: 'user-1', document: otherDocument })).toBe(true)
  })

  it('limits members to documents they created or are responsible for', () => {
    expect(canManageDocument({ role: 'member', userId: 'creator-1', document: otherDocument })).toBe(true)
    expect(canManageDocument({ role: 'member', userId: 'responsible-1', document: otherDocument })).toBe(true)
    expect(canManageDocument({ role: 'member', userId: 'other-1', document: otherDocument })).toBe(false)
  })

  it('matches delete visibility with the database policy', () => {
    expect(canDeleteDocument({ role: 'admin', userId: 'other-1', document: otherDocument })).toBe(true)
    expect(canDeleteDocument({ role: 'responsible', userId: 'other-1', document: otherDocument })).toBe(false)
    expect(canDeleteDocument({ role: 'member', userId: 'creator-1', document: otherDocument })).toBe(true)
    expect(canDeleteDocument({
      role: 'member',
      userId: 'creator-1',
      document: { ...otherDocument, status: 'in_progress' },
    })).toBe(false)
  })

  it('uses readable role labels', () => {
    expect(roleLabel('admin')).toBe('Administrador')
    expect(roleLabel('responsible')).toBe('Responsable')
    expect(roleLabel('member')).toBe('Miembro')
  })
})
