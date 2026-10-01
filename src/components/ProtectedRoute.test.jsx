import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'

const authState = vi.hoisted(() => ({ current: {} }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState.current,
}))

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/documents']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/documents" element={<div>DOCUMENT WORKSPACE</div>} />
        </Route>
        <Route path="/login/test" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute workspace continuity', () => {
  beforeEach(() => {
    authState.current = {
      configured: true,
      user: { id: 'user-1' },
      membership: { role: 'admin' },
      loading: false,
      workspaceError: '',
      preferredCompany: { slug: 'test' },
    }
  })

  it('keeps the workspace mounted during a background auth refresh', () => {
    authState.current.loading = true
    renderProtected()
    expect(screen.getByText('DOCUMENT WORKSPACE')).toBeInTheDocument()
    expect(screen.queryByText(/Preparando tu espacio/i)).not.toBeInTheDocument()
  })

  it('shows the loader during the initial session bootstrap', () => {
    authState.current.user = null
    authState.current.membership = null
    authState.current.loading = true
    renderProtected()
    expect(screen.getByText(/Preparando tu espacio/i)).toBeInTheDocument()
  })
})
