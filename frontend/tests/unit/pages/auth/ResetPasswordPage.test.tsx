import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ResetPasswordPage from '../../../../src/pages/auth/ResetPasswordPage'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  searchParams: new URLSearchParams(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [mocks.searchParams],
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

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mocks.navigate.mockReset()
    mocks.post.mockReset()
    mocks.success.mockReset()
    mocks.error.mockReset()
    mocks.searchParams = new URLSearchParams()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>
  )

  it('shows the missing token state and navigates to the login or forgot password pages', async () => {
    renderPage()

    expect(await screen.findByText('Reset link missing')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /request a new link/i }))
    expect(mocks.navigate).toHaveBeenCalledWith('/forgot-password')

    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }))
    expect(mocks.navigate).toHaveBeenCalledWith('/login')
  })

  it('resets the password when a valid token is present', async () => {
    mocks.searchParams = new URLSearchParams('token=token-123')
    mocks.post.mockResolvedValueOnce({ data: {} })

    renderPage()

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')

    fireEvent.change(passwordInputs[0], {
      target: { value: 'Password1' },
    })
    fireEvent.change(passwordInputs[1], {
      target: { value: 'Password1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/password-reset/confirm', {
      token: 'token-123',
      new_password: 'Password1',
      confirm_password: 'Password1',
    }))
    expect(mocks.success).toHaveBeenCalledWith('Password updated')
    expect(await screen.findByText('Password updated')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go to sign in/i })).toBeInTheDocument()
  })
})