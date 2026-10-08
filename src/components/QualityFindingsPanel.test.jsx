import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import QualityFindingsPanel, { inferFollowupCategory } from './QualityFindingsPanel'

const template = [
  { item_number: 1, section: 'HIGIENE PERSONAL', question: 'Higiene adecuada' },
  { item_number: 48, section: 'REGISTROS', question: 'Cartelería visible' },
  { item_number: 50, section: 'REGISTROS', question: 'Otros controles' },
]
const answers = {
  1: { result: 'non_complies', comments: 'Sin protección', correctiveAction: '',
    followupStatus: 'open', evidenceBefore: 'antes.jpg' },
  48: { result: 'partial', comments: 'Cartel desactualizado', correctiveAction: 'Actualizar cartel',
    followupStatus: 'closed' },
  50: { result: 'complies', comments: 'Cumple' },
}
const defaults = {
  template, answers, savedItems: [1, 48, 50], canEdit: true, savingItem: null,
  inspection: { status: 'draft' }, onChange: vi.fn(), onSave: vi.fn(),
  onAttachEvidence: vi.fn(), onShowEvidence: vi.fn(),
}

describe('Hallazgos y seguimiento (segunda hoja P-07-R-06)', () => {
  it('clasifica áreas de seguimiento, incluyendo inventario', () => {
    expect(inferFollowupCategory(template[0])).toBe('HIGIENE Y PRÁCTICAS SANITARIAS')
    expect(inferFollowupCategory(template[1])).toBe('CARTELERÍA')
    expect(inferFollowupCategory(template[2])).toBe('INVENTARIO')
  })
  it('muestra solo hallazgos guardados y conserva el antes/después', () => {
    render(<QualityFindingsPanel {...defaults} />)
    expect(screen.getByText(/Higiene adecuada/)).toBeTruthy()
    expect(screen.getByText(/Cartelería visible/)).toBeTruthy()
    expect(screen.queryByText(/Otros controles/)).toBeNull()
    expect(screen.getByText('NO CUMPLE')).toBeTruthy()
    expect(screen.getByText('CUMPLE PARCIAL')).toBeTruthy()
    expect(screen.getAllByText('ANTES').length).toBeGreaterThan(0)
    expect(screen.getAllByText('DESPUÉS').length).toBeGreaterThan(0)
  })
  it('permite guardar acciones pero no sobrescribir el hallazgo original', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    render(<QualityFindingsPanel {...defaults} onChange={onChange} onSave={onSave} />)
    const hallazgo = screen.getByLabelText('Hallazgo original del ítem 1')
    expect(hallazgo.disabled).toBe(true)
    fireEvent.change(screen.getAllByPlaceholderText('Acción acordada y cómo se resolverá')[0], {
      target: { value: 'Capacitar personal' },
    })
    expect(onChange).toHaveBeenCalledWith(1, { correctiveAction: 'Capacitar personal' })
    fireEvent.click(screen.getAllByText('Guardar seguimiento')[0])
    expect(onSave).toHaveBeenCalledWith(1)
  })
  it('impide reescribir la foto del antes tras cerrar una inspección', () => {
    render(<QualityFindingsPanel {...defaults} inspection={{ status: 'closed' }} />)
    expect(screen.getByText('Ver foto')).toBeTruthy()
    expect(screen.getAllByText('Agregar foto').length).toBe(2)
  })
})
