export const DOCUMENT_BUCKET = 'sgi-documents'
export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024

export const DOCUMENT_STATUSES = {
  draft: {
    label: 'Borrador',
    description: 'Documento en elaboración o revisión inicial.',
  },
  in_progress: {
    label: 'En proceso',
    description: 'Documento en revisión formal o pendiente de validación.',
  },
  approved: {
    label: 'Aprobado',
    description: 'Documento validado y vigente.',
  },
}

export const NORM_OPTIONS = ['General', 'ISO 9001', 'ISO 14001', 'ISO 45001', 'SGI']

export const DOCUMENT_TYPE_OPTIONS = [
  'Procedimiento',
  'Registro',
  'Instructivo',
  'Política',
  'Planilla',
  'Informe',
  'Manual',
  'Otro',
]

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
]
