import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import HysPage from './HysPage'
import { createHysRecord, loadHys } from '../services/hysService'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ company: { id: 'qa', name: 'Empresa QA' }, user: { id: 'admin' }, role: 'admin' }),
}))
vi.mock('../services/hysService', async (original) => ({
  ...await original(), loadHys: vi.fn(), createHysRecord: vi.fn(),
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
  loadHys.mockImplementation(async () => ({ units: [], actions: [], records: [...records], grants: [], members: [] }))
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
  fireEvent.change(screen.getByLabelText('Nombre de la subcarpeta'), { target: { value: 'Renovaciones' } })
  fireEvent.click(screen.getByRole('button', { name: 'Agregar primer archivo' }))
  expect(screen.getByLabelText('Subapartado')).toHaveValue('03 / Renovaciones')
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Renovación anual' } })
  fireEvent.change(screen.getByLabelText(/Archivo \(obligatorio\)/), { target: { files: [new File(['doc'], 'renovacion.txt')] } })
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar en legajo' }).form)
  expect(await screen.findByText('Renovación anual')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a los subapartados' }))
  expect(screen.getByRole('button', { name: /Renovaciones 1 registro/ })).toBeVisible()
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
