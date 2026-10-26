// Mensajes visibles antes de una eliminación; la base revalida todo al confirmar.
export function getCompanyDeletionBlockReason(company) {
  if (!company) return 'Empresa no disponible.'
  if (company.slug === 'ep-consultora') return 'El espacio principal de gestiQa está protegido.'

  const reasons = []
  if (company.is_active) {
    reasons.push('Primero archivá esta empresa con el botón de archivo. Así dejará de aparecer en el acceso de usuarios.')
  }

  const documents = Number(company.document_count || 0)
  if (documents > 0) {
    reasons.push(`La empresa tiene ${documents} documento${documents === 1 ? '' : 's'}. Para preservar esos archivos no se permite eliminarla. Podés mantenerla archivada.`)
  }

  return reasons.join(' ')
}
