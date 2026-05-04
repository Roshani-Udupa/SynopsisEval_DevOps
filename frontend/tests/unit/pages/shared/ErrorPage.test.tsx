import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ErrorPage from '../../../../src/pages/shared/ErrorPage'
import { useAuthStore } from '../../../../src/store/authStore'

const navigateMock = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock.navigate,
  }
})

describe('ErrorPage', () => {
  beforeEach(() => {
    localStorage.clear()
    navigateMock.navigate.mockReset()
    useAuthStore.setState({ user: null })
  })

  const renderPage = (pathname: string) => render(
    <MemoryRouter initialEntries={[pathname]}>
      <ErrorPage />
    </MemoryRouter>
  )

  it('renders the 403 page for a pending student user', () => {
    useAuthStore.setState({
      user: {
        user_id: 'student-1',
        role: 'student_member',
        full_name: 'Student User',
        status: 'pending',
        access_token: 'token-123',
      },
    })

    renderPage('/error/403')

    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument()
    expect(screen.getByText(/your account is awaiting admin approval/i)).toBeInTheDocument()
    expect(screen.getByText(/student member access only/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /synopsis portal/i })).toHaveAttribute('href', '/student')
    expect(screen.getByRole('link', { name: /^dashboard$/i })).toHaveAttribute('href', '/student')

    fireEvent.click(screen.getByRole('button', { name: /go back/i }))

    expect(navigateMock.navigate).toHaveBeenCalledWith(-1)
  })

  it('renders the fallback login route when no user is available', () => {
    renderPage('/error/403')

    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument()
    expect(screen.getByText(/you are not logged in/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /synopsis portal/i })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^notifications$/i })).not.toBeInTheDocument()
  })

  it('renders the 404 page for an admin user', () => {
    useAuthStore.setState({
      user: {
        user_id: 'admin-1',
        role: 'admin',
        full_name: 'Admin User',
        status: 'approved',
        access_token: 'token-123',
      },
    })

    renderPage('/missing-page')

    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /synopsis portal/i })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: /^dashboard$/i })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: /^settings$/i })).toBeInTheDocument()
  })

  it('renders the 500 page for a reviewer user', () => {
    useAuthStore.setState({
      user: {
        user_id: 'reviewer-1',
        role: 'reviewer',
        full_name: 'Reviewer User',
        status: 'approved',
        access_token: 'token-123',
      },
    })

    renderPage('/error/500')

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /synopsis portal/i })).toHaveAttribute('href', '/reviewer')
    expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^notifications$/i })).toBeInTheDocument()
  })
})