import { describe, expect, it } from 'vitest'
import {
  HYS_DOCUMENT_MAX_SIZE, HYS_VIDEO_MAX_SIZE, HYS_FILE_ACCEPT, HYS_FILE_TYPES,
  getHysFileMaxSize, isHysVideoFile, validateHysFile,
} from './hysFileTypes'

const file = (name, size) => ({ name, size })

describe('archivos del legajo de Higiene y Seguridad', () => {
  it('admite PowerPoint y OpenDocument sin depender del MIME comunicado por el navegador', () => {
    for (const ext of ['ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'odp']) {
      expect(validateHysFile(file('capacitacion.' + ext, 1200))).toMatch(/^application\//)
      expect(HYS_FILE_ACCEPT).toContain('.' + ext)
    }
  })

  it('admite videos MP4, WebM, MOV y M4V con MIME correcto', () => {
    for (const ext of ['mp4', 'webm', 'mov', 'm4v']) {
      expect(validateHysFile(file('induccion.' + ext, 10 * 1024 * 1024))).toMatch(/^video\//)
      expect(isHysVideoFile('INDUCCION.' + ext.toUpperCase())).toBe(true)
    }
  })

  it('preserva límite de 25 MB para documentos y admite hasta 50 MB para videos', () => {
    expect(getHysFileMaxSize('capacitacion.pptx')).toBe(HYS_DOCUMENT_MAX_SIZE)
    expect(getHysFileMaxSize('video.mp4')).toBe(HYS_VIDEO_MAX_SIZE)
    expect(validateHysFile(file('capacitacion.pptx', HYS_DOCUMENT_MAX_SIZE))).toBe(HYS_FILE_TYPES.pptx)
    expect(validateHysFile(file('video.mp4', HYS_VIDEO_MAX_SIZE))).toBe(HYS_FILE_TYPES.mp4)
    expect(() => validateHysFile(file('capacitacion.pptx', HYS_DOCUMENT_MAX_SIZE + 1))).toThrow('25 MB')
    expect(() => validateHysFile(file('video.mp4', HYS_VIDEO_MAX_SIZE + 1))).toThrow('50 MB')
  })

  it('conserva todos los formatos documentales aceptados previamente', () => {
    for (const ext of ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'png', 'jpg', 'jpeg', 'webp']) {
      expect(validateHysFile(file('archivo.' + ext, 500))).toBeTruthy()
    }
  })

  it('rechaza formatos desconocidos y archivos vacíos', () => {
    expect(validateHysFile(null)).toBeNull()
    expect(() => validateHysFile(file('archivo.html', 100))).toThrow('Se admiten')
    expect(() => validateHysFile(file('video.mp4', 0))).toThrow('no esté vacío')
    expect(() => validateHysFile(file('archivo.pdf', -1))).toThrow('no esté vacío')
  })
})
