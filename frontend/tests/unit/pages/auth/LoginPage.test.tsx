import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../../../../src/store/authStore'
import LoginPage from '../../../../src/pages/auth/LoginPage'

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

vi.mock('../../../../src/utils/api', () => ({
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

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null })
    mocks.navigate.mockReset()
    mocks.post.mockReset()
    mocks.success.mockReset()
    mocks.error.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )

  it('logs in an admin and routes to the admin portal', async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        access_token: 'token-123',
        user_id: '1',
        role: 'admin',
        full_name: 'Admin User',
        status: 'approved',
      },
    })

    renderPage()

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'admin@synopsis.edu' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'admin123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/admin'))
    expect(useAuthStore.getState().user?.role).toBe('admin')
    expect(mocks.success).toHaveBeenCalledWith('Welcome back, Admin!')
  })

  it('shows the approval warning for pending accounts', async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        access_token: 'token-123',
        user_id: '2',
        role: 'student_leader',
        full_name: 'Student Leader',
        status: 'pending',
      },
    })

    renderPage()

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'leader@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'leader123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(screen.getByText('Your account is awaiting administrator approval.')).toBeInTheDocument()
    )
    expect(useAuthStore.getState().user).toBeNull()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('shows an error toast for invalid credentials', async () => {
    mocks.post.mockRejectedValueOnce({
      response: { data: { detail: 'Invalid email or password' } },
    })

    renderPage()

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'wrong@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrongpass' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Invalid email or password'))
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})