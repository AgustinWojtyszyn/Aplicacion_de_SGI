import { describe, expect, it } from 'vitest'
import { MAX_DOCUMENT_SIZE } from '../lib/constants'
import { validateDocumentFile } from './documentService'

describe('validateDocumentFile', () => {
  it('accepts a supported PDF within the size limit', () => {
    expect(() => validateDocumentFile({ name: 'manual.pdf', size: 1024, type: 'application/pdf' })).not.toThrow()
  })

  it('rejects files larger than 25 MB', () => {
    expect(() =>
      validateDocumentFile({ name: 'manual.pdf', size: MAX_DOCUMENT_SIZE + 1, type: 'application/pdf' }),
    ).toThrow(/25 MB/i)
  })

  it('rejects unsupported file formats', () => {
    expect(() => validateDocumentFile({ name: 'archivo.zip', size: 1000, type: 'application/zip' })).toThrow(/Formato no admitido/i)
  })

  it('accepts Word files when Android reports a generic MIME', () => {
    expect(() => validateDocumentFile({
      name: 'procedimiento.docx',
      size: 2048,
      type: 'application/octet-stream',
    })).not.toThrow()
  })

  it('accepts legacy Word files even with an empty MIME', () => {
    expect(() => validateDocumentFile({
      name: 'procedimiento.doc',
      size: 2048,
      type: '',
    })).not.toThrow()
  })

  it('accepts every supported common office family by extension', () => {
    for (const name of ['manual.docx', 'planilla.xlsx', 'presentacion.pptx', 'texto.odt', 'datos.csv']) {
      expect(() => validateDocumentFile({ name, size: 2048, type: '' })).not.toThrow()
    }
  })

  it('rejects empty files before any upload is attempted', () => {
    expect(() => validateDocumentFile({ name: 'manual.docx', size: 0, type: '' })).toThrow(/vacío/i)
  })

  it('requires a file', () => {
    expect(() => validateDocumentFile(null)).toThrow(/Seleccioná un archivo/i)
  })
})
