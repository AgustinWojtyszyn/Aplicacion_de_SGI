import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import HysPage from './HysPage'
import { createHysRecord, loadHys, saveHysFolder, deleteHysFolder } from '../services/hysService'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ company: { id: 'qa', name: 'Empresa QA' }, user: { id: 'admin' }, role: 'admin' }),
}))
vi.mock('../services/hysService', async (original) => ({
  ...await original(), loadHys: vi.fn(), createHysRecord: vi.fn(), saveHysFolder: vi.fn(), deleteHysFolder: vi.fn(),
}))

it('opens the action folders and the editable plan for the selected establishment', async () => {
  loadHys.mockResolvedValue({
    units: [{ id: 'north', name: 'Planta Norte' }, { id: 'south', name: 'Sede Sur' }],
    actions: [], records: [], grants: [], members: [], companyDetailsAvailable: true,
  })
  render(<HysPage/>)
  fireEvent.change(await screen.findByLabelText('Abrir legajo del establecimiento'), { target: { value: 'south' } })
  fireEvent.click(screen.getByRole('button', { name: /12 Seguimiento/ }))
  fireEvent.click(screen.getByRole('button', { name: /Evidencias 0 registros/ }))
  expect(screen.getByRole('button', { name: 'Subir documento' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir plan de acción de esta sede' }))
  expect(screen.getByLabelText('Establecimiento')).toHaveValue('south')
})

it('opens the company matrix without a site and uploads several files into the selected topic', async () => {
  const records = [{ id: 'old', section: 'general', unit_id: null, category: 'ART y cobertura', title: 'Póliza anterior', version_no: 1 }]
  const folders = []
  loadHys.mockImplementation(async () => ({
    units: [], actions: [], records: [...records], folders: [...folders],
    foldersAvailable: true, grants: [], members: [],
  }))
  saveHysFolder.mockImplementation(async ({ name, parentCategory, section, id }) => {
    const existing = folders.find(f => f.id === id)
    if (existing) { existing.name = name; existing.category = parentCategory + name; return existing }
    const folder = { id: 'folder-' + (folders.length + 1), name, category: parentCategory + name,
      section, unit_id: null, parent_category: parentCategory }
    folders.push(folder)
    return folder
  })
  deleteHysFolder.mockImplementation(async id => {
    const index = folders.findIndex(f => f.id === id)
    if (index >= 0) folders.splice(index, 1)
  })
  createHysRecord.mockImplementation(async ({ values, unitId }) => {
    records.push({ ...values, id: String(records.length), unit_id: unitId || null, version_no: 1 })
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
  expect(screen.getByRole('button', { name: /03.02 RGRL.*2 registros/ })).toBeVisible()
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
      section, unit_id: null }
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
  expect(await screen.findByRole('button', { name: /Archivo 2026 0 registros/ })).toBeVisible()
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
