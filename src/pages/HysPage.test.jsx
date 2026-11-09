import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import HysPage from './HysPage'
import { loadHys } from '../services/hysService'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ company: { id: 'qa', name: 'Empresa QA' }, user: { id: 'admin' }, role: 'admin' }),
}))
vi.mock('../services/hysService', async (original) => ({
  ...await original(), loadHys: vi.fn(),
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
