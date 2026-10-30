// The DB has only three persisted statuses. These are UI stages derived from
// review metadata and rejection history; they do not introduce enum values.
export const DOCUMENT_VISUAL_LABELS = Object.freeze({
  draft: 'Borrador',
  review_pending: 'Pendiente de revisión',
  approval_pending: 'Pendiente de aprobación',
  approved: 'Aprobado',
  returned: 'Devuelto para corrección',
})

export function documentVisualState(document, returned = false) {
  if (document?.status === 'approved') return 'approved'
  if (document?.status === 'draft') return returned ? 'returned' : 'draft'
  if (document?.status === 'in_progress') return document.reviewed_at ? 'approval_pending' : 'review_pending'
  return 'unknown'
}
