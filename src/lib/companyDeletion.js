// La eliminación se confirma en un modal propio. La empresa principal está protegida.
export function getCompanyDeletionBlockReason(company) {
  if (!company) return 'Empresa no disponible.'
  if (company.slug === 'ep-consultora') return 'El espacio principal de gestiQa está protegido.'
  return ''
}
