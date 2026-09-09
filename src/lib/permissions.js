export function canManageUsers(role) {
  return role === 'admin'
}

export function canManageDocument({ role, userId, document }) {
  if (!document || !userId) return false
  if (role === 'admin' || role === 'responsible') return true
  return document.created_by === userId || document.responsible_id === userId
}

export function canDeleteDocument({ role, userId, document }) {
  if (!document || !userId) return false
  if (role === 'admin') return true
  return document.created_by === userId && document.status === 'draft'
}

export function roleLabel(role) {
  if (role === 'admin') return 'Administrador'
  if (role === 'responsible') return 'Responsable'
  return 'Miembro'
}
