import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ForgotPasswordPage from '../../../../src/pages/auth/ForgotPasswordPage'

const apiMock = vi.hoisted(() => ({
  post: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    apiMock.post.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>
  )

  it('shows form validation for invalid email addresses', async () => {
    renderPage()

    fireEvent.submit(document.querySelector('form')!)

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(apiMock.post).not.toHaveBeenCalled()
  })

  it('submits the reset request and shows the success state', async () => {
    apiMock.post.mockResolvedValueOnce({ data: {} })

    renderPage()

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'student@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/auth/password-reset/request', {
      email: 'student@example.com',
    }))
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument()
    expect(screen.getByText(/student@example.com/i)).toBeInTheDocument()
  })
})