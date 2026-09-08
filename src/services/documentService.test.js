import { describe, expect, it } from 'vitest'
import { MAX_DOCUMENT_SIZE } from '../lib/constants'
import { validateDocumentFile } from './documentService'

describe('validateDocumentFile', () => {
  it('accepts a supported PDF within the size limit', () => {
    expect(() => validateDocumentFile({ size: 1024, type: 'application/pdf' })).not.toThrow()
  })

  it('rejects files larger than 25 MB', () => {
    expect(() =>
      validateDocumentFile({ size: MAX_DOCUMENT_SIZE + 1, type: 'application/pdf' }),
    ).toThrow(/25 MB/i)
  })

  it('rejects unsupported file formats', () => {
    expect(() => validateDocumentFile({ size: 1000, type: 'application/zip' })).toThrow(/Formato no admitido/i)
  })

  it('requires a file', () => {
    expect(() => validateDocumentFile(null)).toThrow(/Seleccioná un archivo/i)
  })
})
