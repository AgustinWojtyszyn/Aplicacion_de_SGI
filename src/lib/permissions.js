export function canManageUsers(role) {
  return role === 'admin'
}

export function canManageCompanies({ role, isPlatformAdmin }) {
  return role === 'admin' && Boolean(isPlatformAdmin)
}

export function canManageDocument({ role, userId, document }) {
  return Boolean(userId && document && document.status === 'draft' && role === 'admin')
}

export function canDeleteDocument({ role, userId, document }) {
  return Boolean(userId && document && role === 'admin')
}

export function canReviewDocument({ role, userId, document }) {
  return Boolean(document && userId && document.status === 'in_progress'
    && (role === 'admin' || (role === 'responsible' && document.reviewer_id === userId)))
}

export function canApproveDocument({ role, userId, document }) {
  return Boolean(document && userId && document.status === 'in_progress'
    && document.reviewed_at
    && (role === 'admin' || (role === 'responsible' && document.approver_id === userId)))
}

export function canRejectDocument({ role, userId, document }) {
  return Boolean(document && userId && document.status === 'in_progress'
    && (role === 'admin' || (role === 'responsible'
      && (document.reviewer_id === userId || document.approver_id === userId))))
}

export function canCommentDocument({ role, userId, document }) {
  return Boolean(document && userId && (role === 'admin'
    || (role === 'responsible'
      && (document.reviewer_id === userId || document.approver_id === userId))))
}

export function roleLabel(role) {
  if (role === 'admin') return 'Administrador'
  if (role === 'responsible') return 'Responsable'
  return 'Usuario'
}
