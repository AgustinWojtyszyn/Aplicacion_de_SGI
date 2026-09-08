import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the business label for approved documents', () => {
    render(<StatusBadge status="approved" />)
    expect(screen.getByText('Aprobado')).toHaveClass('status-approved')
  })

  it('renders the in-process label', () => {
    render(<StatusBadge status="in_progress" />)
    expect(screen.getByText('En proceso')).toBeInTheDocument()
  })
})
