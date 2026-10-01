export const APP_URL = (import.meta.env.VITE_APP_URL || 'https://aplicacion-de-sgi-1.onrender.com').replace(/\/+$/, '')

export const DOCUMENT_BUCKET = 'sgi-documents'
export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024

export const DOCUMENT_STATUSES = {
  draft: { label: 'Borrador', description: 'Documento en elaboración o revisión inicial.' },
  in_progress: { label: 'En proceso', description: 'Documento en revisión formal o pendiente de validación.' },
  approved: { label: 'Aprobado', description: 'Documento validado y vigente.' },
}

export const NORM_OPTIONS = ['General', 'ISO 9001', 'ISO 14001', 'ISO 45001', 'SGI']

export const DOCUMENT_TYPE_OPTIONS = [
  'Procedimiento', 'Registro', 'Instructivo', 'Política', 'Planilla', 'Informe', 'Manual', 'Otro',
]

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  'pdf',
  'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm',
  'xls', 'xlsx', 'xlsm', 'xlsb', 'xlt', 'xltx', 'xltm',
  'ppt', 'pptx', 'pptm', 'pps', 'ppsx',
  'odt', 'ods', 'odp',
  'rtf', 'txt', 'csv',
  'jpg', 'jpeg', 'png', 'webp',
]

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-word.document.macroEnabled.12',
  'application/vnd.ms-word.template.macroEnabled.12',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  'application/vnd.ms-excel.template.macroEnabled.12',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf', 'text/rtf', 'text/plain', 'text/csv',
  'image/jpeg', 'image/png', 'image/webp',
]

export const DOCUMENT_ACCEPT = ALLOWED_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',')
