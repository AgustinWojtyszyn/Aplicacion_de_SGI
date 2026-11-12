import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import HysPage from './HysPage'
import { checkHysFolderUpload, uploadHysFolderFile, createHysRecord, loadHys, saveHysFolder, deleteHysFolder, saveHysUnitSection } from '../services/hysService'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ company: { id: 'qa', name: 'Empresa QA' }, user: { id: 'admin' }, role: 'admin' }),
}))
vi.mock('../services/hysService', async (original) => ({
  ...await original(), checkHysFolderUpload: vi.fn(), uploadHysFolderFile: vi.fn(), loadHys: vi.fn(), createHysRecord: vi.fn(), saveHysFolder: vi.fn(), deleteHysFolder: vi.fn(), saveHysUnitSection: vi.fn(),
}))

it('opens the action folders and the editable plan for the selected establishment', async () => {
  loadHys.mockResolvedValue({
    units: [{ id: 'north', name: 'Planta Norte' }, { id: 'south', name: 'Sede Sur' }],
    actions: [], records: [], grants: [], members: [], companyDetailsAvailable: true,
  })
  render(<HysPage/>)
  fireEvent.change(await screen.findByLabelText('Abrir legajo del establecimiento'), { target: { value: 'south' } })
  fireEvent.click(screen.getByRole('button', { name: /12 Seguimiento/ }))
  fireEvent.click(screen.getByRole('button', { name: /Acciones correctivas y preventivas 0 registros/ }))
  expect(screen.getByRole('button', { name: 'Subir documento' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir plan de acción de esta sede' }))
  expect(screen.getByLabelText('Establecimiento')).toHaveValue('south')
})

it('opens the company matrix without a site and uploads several files into the selected topic', async () => {
  const records = [{ id: 'historical-art', company_id: 'qa', section: 'general', unit_id: null, category: '03 / 03.02 RGRL – Relevamiento General de Riesgos Laborales', title: 'Histórico ART', version_no: 1 }, { id: 'old', company_id: 'qa', section: 'general', unit_id: null, category: 'ART y cobertura', title: 'Póliza anterior', version_no: 1 }]
  const folders = []
  loadHys.mockImplementation(async () => ({
    units: [], actions: [], records: [...records], folders: [...folders],
    foldersAvailable: true, grants: [], members: [],
  }))
  saveHysFolder.mockImplementation(async ({ name, parentCategory, section, id }) => {
    const existing = folders.find(f => f.id === id)
    if (existing) { existing.name = name; existing.category = parentCategory + name; return existing }
    const folder = { id: 'folder-' + (folders.length + 1), name, category: parentCategory + name,
      company_id: 'qa', section, unit_id: null, parent_category: parentCategory }
    folders.push(folder)
    return folder
  })
  deleteHysFolder.mockImplementation(async id => {
    const index = folders.findIndex(f => f.id === id)
    if (index >= 0) folders.splice(index, 1)
  })
  createHysRecord.mockImplementation(async ({ values, unitId }) => {
    records.push({ ...values, company_id: 'qa', id: String(records.length), unit_id: unitId || null, version_no: 1 })
  })
  render(<HysPage/>)
  fireEvent.click(await screen.findByRole('button', { name: 'Documentación general' }))
  fireEvent.click(await screen.findByRole('button', { name: /ART y cobertura/ }))
  expect(screen.getByText('Póliza anterior')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a la matriz' }))
  fireEvent.click(screen.getByRole('button', { name: '03 · ART' }))
  fireEvent.click(screen.getByRole('button', { name: /03.02 RGRL/ }))
  for (const title of ['Informe inicial', 'Informe anual']) {
    fireEvent.click(screen.getByRole('button', { name: 'Subir documento' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: title } })
    const file = new File(['test'], title + '.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText(/Archivo \(obligatorio\)/), { target: { files: [file] } })
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar en legajo' }).form)
    expect(await screen.findByText(title)).toBeVisible()
    expect(createHysRecord).toHaveBeenLastCalledWith(expect.objectContaining({
      unitId: '', file, values: expect.objectContaining({ section: 'general', category: '03 / 03.02 RGRL – Relevamiento General de Riesgos Laborales' }),
    }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Volver a los subapartados' }))
  expect(screen.getByRole('button', { name: /03.02 RGRL.*3 registros/ })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Crear subcarpeta' }))
  expect(screen.getByRole('dialog', { name: 'Crear carpeta' })).toBeVisible()
  fireEvent.change(screen.getByLabelText('Nombre de la subcarpeta'), { target: { value: 'Renovaciones' } })
  fireEvent.submit(screen.getByRole('dialog', { name: 'Crear carpeta' }))
  expect(await screen.findByRole('button', { name: /Renovaciones 0 registros/ })).toBeVisible()
  expect(saveHysFolder).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renovaciones', parentCategory: '03 / ' }))
  fireEvent.click(screen.getByRole('button', { name: /Renovaciones 0 registros/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Subir documento' }))
  expect(screen.getByLabelText('Subapartado')).toHaveValue('03 / Renovaciones')
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Renovación anual' } })
  fireEvent.change(screen.getByLabelText(/Archivo \(obligatorio\)/), { target: { files: [new File(['doc'], 'renovacion.txt')] } })
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar en legajo' }).form)
  expect(await screen.findByText('Renovación anual')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a los subapartados' }))
  expect(screen.getByRole('button', { name: /Renovaciones 1 registro/ })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar carpeta Renovaciones' }))
  expect(screen.getByRole('dialog', { name: 'Eliminar carpeta' })).toHaveTextContent(/Movelos primero/)
  expect(screen.getByRole('button', { name: 'Confirmar eliminación' })).toBeDisabled()
})

it('creates, renames and deletes an empty folder without requiring documents', async () => {
  const folders = []
  loadHys.mockImplementation(async () => ({
    units: [], actions: [], records: [], folders: [...folders], foldersAvailable: true,
    grants: [], members: [], companyDetailsAvailable: true,
  }))
  saveHysFolder.mockImplementation(async ({ id, name, parentCategory, section }) => {
    if (id) {
      const folder = folders.find(f => f.id === id)
      folder.name = name
      folder.category = name
      return folder
    }
    const folder = { id: 'empty', name, category: name, parent_category: parentCategory,
      company_id: 'qa', section, unit_id: null }
    folders.push(folder)
    return folder
  })
  deleteHysFolder.mockImplementation(async id => {
    folders.splice(folders.findIndex(f => f.id === id), 1)
  })
  render(<HysPage/>)
  fireEvent.click(await screen.findByRole('button', { name: 'Documentación general' }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear carpeta' }))
  fireEvent.change(screen.getByLabelText('Nombre de la carpeta'), { target: { value: 'Temporal' } })
  fireEvent.submit(screen.getByRole('dialog', { name: 'Crear carpeta' }))
  fireEvent.click(await screen.findByRole('button', { name: /Temporal 0 registros/ }))
  expect(screen.getByText(/Esta carpeta no tiene documentos/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a la matriz' }))
  fireEvent.click(screen.getByRole('button', { name: 'Editar carpeta Temporal' }))
  fireEvent.change(screen.getByLabelText('Nombre de la carpeta'), { target: { value: 'Archivo 2026' } })
  fireEvent.submit(screen.getByRole('dialog', { name: 'Editar carpeta' }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Editar carpeta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Archivo 2026 0 registros/ })).toBeVisible()
  })
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar carpeta Archivo 2026' }))
  expect(screen.getByText(/La carpeta está vacía/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))
  expect(await screen.findByText('Carpeta vacía eliminada.')).toBeVisible()
  expect(screen.queryByRole('button', { name: /Archivo 2026 0 registros/ })).not.toBeInTheDocument()
})

it('offers a blank template and import to begin the action plan', async () => {
  loadHys.mockResolvedValue({
    units: [{ id: 'central', name: 'Edificio Central' }],
    actions: [], records: [], grants: [], members: [], companyDetailsAvailable: true,
  })
  render(<HysPage/>)
  fireEvent.click(await screen.findByRole('button', { name: 'Plan de acción' }))
  expect(screen.getByRole('button', { name: 'Plantilla Excel' })).toBeEnabled()
  expect(screen.getByText(/Todavía no hay acciones cargadas/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Importar Excel' }))
  expect(screen.getByRole('dialog', { name: 'Importar acciones desde Excel' })).toBeVisible()
})

it('creates and hides an independent legajo section, then restores the original', async () => {
  const sections = []
  loadHys.mockImplementation(async () => ({
    units: [{ id: 'north', name: 'Planta Norte' }, { id: 'south', name: 'Sede Sur' }],
    actions: [], records: [], folders: [], foldersAvailable: true,
    sectionSettings: [...sections], sectionSettingsAvailable: true,
    grants: [], members: [], companyDetailsAvailable: true,
  }))
  saveHysUnitSection.mockImplementation(async value => {
    const index = sections.findIndex(s => s.unit_id === value.unitId && s.code === value.code)
    const updated = { code: value.code, label: value.label, unit_id: value.unitId,
      company_id: value.companyId, is_active: value.enabled }
    if (index === -1) sections.push(updated)
    else sections[index] = updated
    return updated
  })
  render(<HysPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Planta Norte' }))
  fireEvent.click(screen.getByRole('button', { name: 'Agregar apartado' }))
  fireEvent.change(screen.getByLabelText('Nombre del apartado'), { target: { value: 'Control de máquinas' } })
  fireEvent.submit(screen.getByRole('dialog', { name: 'Crear apartado' }))
  await waitFor(() => expect(saveHysUnitSection).toHaveBeenCalledWith(expect.objectContaining({
    companyId: 'qa', unitId: 'north', label: 'Control de máquinas', enabled: true,
  })))
  fireEvent.click(screen.getByRole('button', { name: 'Sede Sur' }))
  expect(screen.queryByRole('button', { name: /Control de máquinas/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Planta Norte' }))
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar apartado Legajo legal' }))
  expect(screen.getByRole('dialog', { name: 'Eliminar apartado' })).toHaveTextContent(/conservarán/)
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Eliminar apartado' }))
    .getByRole('button', { name: 'Eliminar apartado' }))
  await waitFor(() => expect(saveHysUnitSection).toHaveBeenLastCalledWith(expect.objectContaining({
    unitId: 'north', code: 'legal', enabled: false,
  })))
  expect(screen.queryByRole('button', { name: 'Eliminar apartado Legajo legal' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Recuperar eliminados' }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Recuperar apartados' }))
    .getByRole('button', { name: 'Recuperar' }))
  await waitFor(() => expect(saveHysUnitSection).toHaveBeenLastCalledWith(expect.objectContaining({
    unitId: 'north', code: 'legal', enabled: true,
  })))
})

it('isolates Melisa’s repurposed section while keeping saved documents and nested folders accessible', async () => {
  loadHys.mockResolvedValue({
    units: [{ id: 'north', name: 'Planta Norte' }, { id: 'south', name: 'Sede Sur' }],
    actions: [], grants: [], members: [], foldersAvailable: true,
    sectionSettings: [{ company_id: 'qa', unit_id: 'north', code: 'legal', label: 'Material de capacitación', is_active: true }],
    records: [{ id: 'old', company_id: 'qa', unit_id: 'north', section: 'legal', category: 'Legajo histórico', title: 'Documento conservado', version_no: 1 }],
    folders: [
      { id: 'own', company_id: 'qa', unit_id: 'north', section: 'legal', name: '1. Inducción en H&S', category: '1. Inducción en H&S', parent_category: null },
      { id: 'child', company_id: 'qa', unit_id: 'north', section: 'legal', name: 'Anexo', category: 'Padre anterior / Anexo', parent_category: 'Padre anterior' },
      ...[['qa', 'south', 'legal'], ['qa', 'north', 'training'], ['other', 'north', 'legal']].map(([company_id, unit_id, section], i) => ({ id: 'foreign' + i, company_id, unit_id, section, name: 'Ajena ' + i, category: 'Ajena ' + i, parent_category: null })),
    ],
  })
  render(<HysPage />)
  fireEvent.change(await screen.findByLabelText('Abrir legajo del establecimiento'), { target: { value: 'north' } })
  fireEvent.click(screen.getByRole('button', { name: /01 Material de capacitación/ }))
  expect(await screen.findByRole('heading', { name: '01 · Material de capacitación' })).toBeVisible()
  expect(screen.getByRole('button', { name: /1. Inducción en H&S 0 registros/ })).toBeVisible()
  expect(screen.queryByRole('button', { name: /^Documentación legal/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Organización preventiva/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Ajena/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Padre anterior 0 registros/ }))
  expect(screen.getByRole('button', { name: /Anexo 0 registros/ })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a los subapartados' }))
  fireEvent.click(screen.getByRole('button', { name: /Legajo histórico 1 registro/ }))
  expect(screen.getByText('Documento conservado')).toBeVisible()
})

it('navigates every matrix section and subfolder without mixing another section’s folders', async () => {
  const { HYS_SECTIONS } = await import('../lib/hysCatalog')
  loadHys.mockResolvedValue({
    units: [{ id: 'north', name: 'Planta Norte' }], actions: [], records: [], grants: [], members: [],
    sectionSettings: [], foldersAvailable: true,
    folders: HYS_SECTIONS.map(s => ({ id: s.code, company_id: 'qa', unit_id: 'north', section: s.code,
      name: 'Personal ' + s.code, category: 'Personal ' + s.code, parent_category: null })),
  })
  render(<HysPage />)
  fireEvent.click(await screen.findByRole('button', { name: /01 Legajo legal/ }))
  for (const section of HYS_SECTIONS) {
    fireEvent.click(screen.getByRole('button', { name: section.number + ' ' + section.label }))
    const folderButtons = [...document.querySelectorAll('.hys-folder-open')]
    expect(folderButtons).toHaveLength(section.categories.length + 1)
    expect(screen.getByRole('button', { name: 'Personal ' + section.code + ' 0 registros' })).toBeVisible()
    for (const name of section.categories) {
      fireEvent.click(screen.getByRole('button', { name: name + ' 0 registros' }))
      expect(screen.getByRole('button', { name: 'Subir documento' })).toBeVisible()
      fireEvent.click(screen.getByRole('button', { name: 'Volver a los subapartados' }))
    }
  }
})

it('previews a directory, creates its nested destination and retries only the interrupted file', async () => {
  const native = vi.fn(async () => ({
    name: 'Capacitaciones 2026',
    async *values() {
      yield {
        kind: 'directory', name: 'Enero',
        async *values() {
          for (const name of ['Asistencia.pdf', 'Presentacion.pptx']) {
            yield { kind: 'file', name, getFile: async () => new File(['contenido'], name) }
          }
        },
      }
    },
  }))
  vi.stubGlobal('showDirectoryPicker', native)
  const originalShowModal = HTMLDialogElement.prototype.showModal
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  const folders = []
  const existing = {
    id: 'existing', company_id: 'qa', unit_id: null, section: 'general',
    category: 'ART y cobertura', title: 'Documento histórico', version_no: 1,
  }
  loadHys.mockImplementation(async () => ({
    units: [], actions: [], records: [existing], folders: [...folders],
    foldersAvailable: true, grants: [], members: [],
  }))
  saveHysFolder.mockClear()
  saveHysFolder.mockImplementation(async ({ companyId, unitId, section, name, parentCategory }) => {
    const folder = { id: name, company_id: companyId, unit_id: unitId, section,
      category: parentCategory + ' / ' + name, parent_category: parentCategory, name }
    folders.push(folder)
    return folder
  })
  checkHysFolderUpload.mockResolvedValue()
  uploadHysFolderFile.mockReset()
  uploadHysFolderFile.mockImplementation(async ({ file }) => {
    if (file.name === 'Presentacion.pptx' && uploadHysFolderFile.mock.calls.filter(
      ([args]) => args.file.name === file.name).length === 1) throw new Error('Offline')
  })
  try {
    render(<HysPage/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Documentación general' }))
    fireEvent.click(screen.getByRole('button', { name: /ART y cobertura/ }))
    expect(screen.getByRole('button', { name: 'Subir documento' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Subir carpeta completa' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Subir carpeta completa' }))
    fireEvent.click(dialog.getByRole('button', { name: 'Elegir carpeta' }))
    expect(await dialog.findByText('Capacitaciones 2026/Enero/Asistencia.pdf')).toBeVisible()
    expect(dialog.getByText(/2 archivo\(s\) para subir · 18 bytes/)).toBeVisible()
    expect(saveHysFolder).not.toHaveBeenCalled()
    fireEvent.click(dialog.getByRole('button', { name: 'Confirmar carga' }))
    fireEvent.click(await dialog.findByRole('button', { name: 'Reintentar fallidos' }))
    expect(await dialog.findByText('Carga completada.')).toBeVisible()
    expect(uploadHysFolderFile.mock.calls.map(([args]) => args.file.name))
      .toEqual(['Asistencia.pdf', 'Presentacion.pptx', 'Presentacion.pptx'])
    expect(uploadHysFolderFile.mock.calls[1][0].id).toBe(uploadHysFolderFile.mock.calls[2][0].id)
    expect(uploadHysFolderFile.mock.calls[0][0].folder.category).toBe('ART y cobertura / Capacitaciones 2026 / Enero')
    fireEvent.click(dialog.getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByText('Documento histórico')).toBeVisible()
    expect(await screen.findByRole('button', { name: /Capacitaciones 2026 0 registros/ })).toBeVisible()
  } finally {
    HTMLDialogElement.prototype.showModal = originalShowModal
    vi.unstubAllGlobals()
  }
})
