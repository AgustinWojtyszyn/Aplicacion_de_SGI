// Solo está pendiente de aprobación el documento revisado que aún espera
// decisión final. Borradores y documentos en revisión no se cuentan aquí.
export function countPendingApprovals(documents = []) {
  return documents.filter((document) => (
    document.status === 'in_progress' && Boolean(document.reviewed_at)
  )).length
}
