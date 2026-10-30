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
  it('distinguishes the review stage in a chapter workflow', () => {
    render(<StatusBadge status="in_progress" showWorkflow />)
    expect(screen.getByText('Pendiente de revisión')).toHaveClass('status-review_pending')
  })

  it('distinguishes documents waiting for approval', () => {
    render(<StatusBadge status="in_progress" reviewedAt="2026-10-29T13:00:00Z" showWorkflow />)
    expect(screen.getByText('Pendiente de aprobación')).toHaveClass('status-approval_pending')
  })

  it('shows rejected documents as returned without overwriting their draft state', () => {
    render(<StatusBadge status="draft" returned showWorkflow />)
    expect(screen.getByText('Devuelto para corrección')).toHaveClass('status-returned')
  })

})
