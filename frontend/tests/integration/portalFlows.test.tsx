import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../../src/pages/auth/LoginPage'
import PortalLayout from '../../src/components/layout/PortalLayout'
import { useAuthStore } from '../../src/store/authStore'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  }
})

vi.mock('../../src/utils/api', () => ({
  default: {
    post: mocks.post,
  },
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: mocks.success,
    error: mocks.error,
  },
}))

describe('portal flows', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null })
    mocks.navigate.mockReset()
    mocks.post.mockReset()
    mocks.success.mockReset()
    mocks.error.mockReset()
  })

  it('logs in through the auth screen and then signs out from the portal shell', async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        access_token: 'token-123',
        user_id: '1',
        role: 'student_member',
        full_name: 'Student One',
        status: 'approved',
      },
    })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'student@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Student123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/student'))

    useAuthStore.setState({
      user: {
        user_id: '1',
        role: 'student_member',
        full_name: 'Student One',
        status: 'approved',
        access_token: 'token-123',
      },
    })

    render(
      <MemoryRouter initialEntries={['/student']}>
        <PortalLayout
          portalTitle="Student Portal"
          navItems={[{ label: 'Dashboard', path: '/student', icon: () => null }]}
        >
          <div>Portal content</div>
        </PortalLayout>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(useAuthStore.getState().user).toBeNull()
    expect(mocks.navigate).toHaveBeenCalledWith('/login')
    expect(screen.getByText('Portal content')).toBeInTheDocument()
  })
})