export const HYS_DOCUMENT_MAX_SIZE = 25 * 1024 * 1024
export const HYS_VIDEO_MAX_SIZE = 50 * 1024 * 1024

export const HYS_FILE_TYPES = Object.freeze({
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  pps: 'application/vnd.ms-powerpoint',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  odp: 'application/vnd.oasis.opendocument.presentation',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
})

export const HYS_FILE_ACCEPT = Object.keys(HYS_FILE_TYPES).map(extension => `.${extension}`).join(',')

export function isHysVideoFile(name = '') {
  return /\.(?:mp4|webm|mov|m4v)$/i.test(String(name))
}

export function getHysFileMaxSize(name = '') {
  return isHysVideoFile(name) ? HYS_VIDEO_MAX_SIZE : HYS_DOCUMENT_MAX_SIZE
}

export function validateHysFile(file) {
  if (!file) return null
  const extension = String(file.name || '').split('.').pop().toLowerCase()
  if (!Object.hasOwn(HYS_FILE_TYPES, extension)) {
    throw new Error('Se admiten PDF, Word, Excel, PowerPoint, OpenDocument, CSV, TXT, imágenes y videos MP4, WebM, MOV o M4V.')
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('Seleccioná un archivo válido que no esté vacío.')
  }
  const maxSize = getHysFileMaxSize(file.name)
  if (file.size > maxSize) {
    throw new Error(`El archivo supera el máximo de ${maxSize / 1024 / 1024} MB.`)
  }
  return HYS_FILE_TYPES[extension]
}
