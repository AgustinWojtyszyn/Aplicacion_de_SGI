import { DOCUMENT_STATUSES } from '../lib/constants'

export default function StatusBadge({ status }) {
  const meta = DOCUMENT_STATUSES[status] || { label: status || 'Sin estado' }
  return <span className={`status-badge status-${status || 'unknown'}`}>{meta.label}</span>
}
