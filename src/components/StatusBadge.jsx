import { DOCUMENT_STATUSES } from '../lib/constants'
import { documentVisualState, DOCUMENT_VISUAL_LABELS } from '../lib/documentVisualState'

export default function StatusBadge({ status, reviewedAt = null, returned = false, showWorkflow = false }) {
  // Other screens keep their existing labels until they supply workflow context.
  const stage = showWorkflow ? documentVisualState({ status, reviewed_at: reviewedAt }, returned) : status
  const label = showWorkflow
    ? DOCUMENT_VISUAL_LABELS[stage] || DOCUMENT_STATUSES[status]?.label
    : DOCUMENT_STATUSES[status]?.label
  return <span className={`status-badge status-${stage || 'unknown'}`}>{label || status || 'Sin estado'}</span>
}
