import { describe, expect, it } from 'vitest'
import { HYS_SECTIONS, hysSectionFolders } from '../lib/hysCatalog'
import { buildActionsExcel, canUseHys, isMissingHysCompanyDetails, isPreviewableHysFile, parseHysActionsWorkbook, normalizeHysAction, normalizeHysCompanyDetails, normalizeHysFolder, isMissingHysFolders } from './hysService'

describe('Higiene y Seguridad', () => {
  it('preserves the thirteen sections requested by the client', () => {
    expect(HYS_SECTIONS.map((s) => s.number)).toEqual(
      Array.from({ length: 13 }, (_, i) => String(i + 1).padStart(2, '0')),
    )
    expect(HYS_SECTIONS.find((s) => s.number === '03').categories).toContain('03.06 Accidentes de trabajo')
  })

  it('normalizes and validates action inputs', () => {
    expect(normalizeHysAction({
      title: '  Instalar señalización  ', description: '  Cocina norte ',
      responsible: '  Técnica HyS ', priority: 'alta', status: 'en_curso', due_date: '',
    })).toEqual({
      title: 'Instalar señalización', description: 'Cocina norte',
      responsible: 'Técnica HyS', priority: 'alta', status: 'en_curso', due_date: null,
    })
    expect(() => normalizeHysAction({
      title: 'ok', priority: 'alta', status: 'pendiente',
    })).toThrow(/entre 3 y 180/)
    expect(() => normalizeHysAction({
      title: 'Revisar matafuegos', priority: 'superior', status: 'pendiente',
    })).toThrow(/Prioridad inválida/)
  })

  it('accepts legal names and normalizes an eleven-digit CUIT', () => {
    expect(normalizeHysCompanyDetails({ legal_name: '  Servi Food  ', cuit: '30-12345678-9' }))
      .toMatchObject({ legal_name: 'Servi Food', cuit: '30123456789' })
    expect(() => normalizeHysCompanyDetails({ cuit: '1234' })).toThrow(/11 dígitos/)
  })

  it('restricts a unit grant to its section and unit, including in edit mode', () => {
    const grants = [{ section: 'actions', unit_id: 'cocina-a', permission: 'edit' }]
    const opts = { isAdmin: false, grants }
    expect(canUseHys({ ...opts, section: 'actions', unitId: 'cocina-a', write: true })).toBe(true)
    expect(canUseHys({ ...opts, section: 'actions', unitId: 'cocina-b', write: true })).toBe(false)
    expect(canUseHys({ ...opts, section: 'general', unitId: null, write: false })).toBe(false)
    expect(canUseHys({ ...opts, section: 'actions', unitId: null, write: false })).toBe(false)
  })

  it('permits company-wide reading but blocks editing without an edit grant', () => {
    const grants = [{ section: 'actions', unit_id: null, permission: 'read' }]
    expect(canUseHys({ grants, isAdmin: false, section: 'actions', unitId: 'cocina-b' })).toBe(true)
    expect(canUseHys({ grants, isAdmin: false, section: 'actions', unitId: 'cocina-b', write: true })).toBe(false)
    expect(canUseHys({ grants, isAdmin: true, section: 'legal', unitId: 'cocina-b', write: true })).toBe(true)
  })

  it('generates an Excel-compatible workbook preserving user content', async () => {
    const bytes = await buildActionsExcel([{ title: 'A&B <C>', description: 'Revisar > 10', status: 'pendiente',
      priority: 'media', responsible: 'Melisa', due_date: '', unit_id: 'cocina-a' }], () => 'Sede A')
    const { read } = await import('xlsx')
    const sheet = read(bytes).Sheets['Plan de acción']
    expect(sheet.A2.v).toBe('A&B <C>')
    expect(sheet.B2.v).toBe('Sede A')
    expect(sheet.G2.v).toBe('Revisar > 10')
  })

  it('shows every subapartado even when there are no documents', () => {
    const art = HYS_SECTIONS.find((s) => s.code === 'art')
    const folders = hysSectionFolders(art, [])
    expect(folders.length).toBe(art.categories.length)
    expect(folders.every((f) => f.count === 0)).toBe(true)
    expect(folders.some((f) => f.name.includes('03.06 Accidentes de trabajo'))).toBe(true)
  })

  it('keeps documents from old or custom subapartados accessible', () => {
    const visits = HYS_SECTIONS.find((s) => s.code === 'visits')
    const folders = hysSectionFolders(visits, [
      { category: 'Registros de visitas' },
      { category: 'Legajo histórico' },
    ])
    expect(folders).toEqual([
      { name: 'Registros de visitas', count: 1 },
      { name: 'Legajo histórico', count: 1 },
    ])
  })

  it('only ignores missing optional company details, never permission problems', () => {
    expect(isMissingHysCompanyDetails({
      code: 'PGRST205',
      message: "Could not find the table 'public.hys_company_details' in the schema cache",
    })).toBe(true)
    expect(isMissingHysCompanyDetails({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isMissingHysCompanyDetails({ code: 'PGRST205', message: 'another table missing' })).toBe(false)
  })

  it('creates independent empty folder paths, including the company matrix prefixes', () => {
    expect(normalizeHysFolder({ name: '  Renovaciones ', parentCategory: '03 / ' })).toEqual({
      name: 'Renovaciones', parentCategory: '03 / ', category: '03 / Renovaciones',
    })
    expect(normalizeHysFolder({ name: '2026', parentCategory: '03 / Renovaciones' }).category)
      .toBe('03 / Renovaciones / 2026')
    expect(normalizeHysFolder({ name: 'Legajo personalizado' }).category).toBe('Legajo personalizado')
    expect(() => normalizeHysFolder({ name: '   ' })).toThrow(/nombre/)
    expect(() => normalizeHysFolder({ name: 'x'.repeat(91) })).toThrow(/90 caracteres/)
    expect(() => normalizeHysFolder({ name: 'x'.repeat(60), parentCategory: 'a'.repeat(120) }))
      .toThrow(/160 caracteres/)
    expect(isMissingHysFolders({ code: 'PGRST205', message: 'hys_folders missing' })).toBe(true)
    expect(isMissingHysFolders({ code: '42501', message: 'permission denied hys_folders' })).toBe(false)
  })

  it('distinguishes previewable PDFs and photos from Office file downloads', () => {
    expect(isPreviewableHysFile('informe.pdf')).toBe(true)
    expect(isPreviewableHysFile('imagen.JPG')).toBe(true)
    expect(isPreviewableHysFile('plan-de-accion.xlsx')).toBe(false)
    expect(isPreviewableHysFile('procedimiento.docx')).toBe(false)
  })

  it('loads the Excel template using the correct establishment and values', async () => {
    const { utils, write } = await import('xlsx')
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([
      ['Acción', 'Establecimiento', 'Responsable', 'Prioridad', 'Estado', 'Vencimiento', 'Descripción'],
      ['Verificar matafuegos', 'Edificio Central', 'Melisa', 'Alta', 'En curso', '20/11/2026', 'Control'],
    ]), 'Plan de acción')
    const bytes = write(workbook, { type: 'array', bookType: 'xlsx' })
    const file = { name: 'plan.xlsx', size: bytes.byteLength || bytes.length, arrayBuffer: async () => bytes.buffer || bytes }
    const options = { units: [{ id: 'central', name: 'Edificio Central' }], canEdit: id => id === 'central' }
    await expect(parseHysActionsWorkbook(file, options)).resolves.toEqual([{
      rowNumber: 2, unitId: 'central', values: {
        title: 'Verificar matafuegos', description: 'Control', responsible: 'Melisa',
        priority: 'alta', status: 'en_curso', due_date: '2026-11-20',
      },
    }])
    await expect(parseHysActionsWorkbook(file, { ...options, canEdit: () => false }))
      .rejects.toThrow(/no tenés permiso/)
  })

  it('rejects an unknown establishment instead of inserting under a different site', async () => {
    const { utils, write } = await import('xlsx')
    const book = utils.book_new()
    utils.book_append_sheet(book, utils.aoa_to_sheet([
      ['Acción', 'Establecimiento'], ['Revisar extintores', 'Sede desconocida'],
    ]), 'Plan de acción')
    const bytes = write(book, { type: 'array', bookType: 'xlsx' })
    await expect(parseHysActionsWorkbook({
      name: 'plan.xlsx', size: bytes.byteLength || bytes.length, arrayBuffer: async () => bytes.buffer || bytes,
    }, { units: [{ id: 'central', name: 'Edificio Central' }], canEdit: () => true }))
      .rejects.toThrow(/no existe o es ambiguo/)
  })

})
