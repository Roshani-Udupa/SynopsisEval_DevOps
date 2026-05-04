import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../../../../src/pages/shared/SettingsPage'
import { useAuthStore } from '../../../../src/store/authStore'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastMock.success,
    error: toastMock.error,
  },
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: {
        user_id: 'user-1',
        role: 'reviewer',
        full_name: 'Dr. Jane Smith',
        status: 'approved',
        access_token: 'token-123',
      },
    })
    apiMock.get.mockReset()
    apiMock.patch.mockReset()
    apiMock.post.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  const profileResponse = {
    data: {
      full_name: 'Dr. Jane Smith',
      email: 'reviewer@example.com',
      role: 'reviewer',
      status: 'approved',
      created_at: '2026-05-01T10:00:00.000Z',
      department: 'Computer Science',
      designation: 'Associate Professor',
      expertise: ['ML'],
      usn: '1AB21CS001',
    },
  }

  const renderPage = () => render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  )

  it('loads the profile and saves profile edits', async () => {
    apiMock.get.mockResolvedValueOnce(profileResponse)
    apiMock.patch.mockResolvedValueOnce({ data: { message: 'Updated' } })

    renderPage()

    const nameInput = await screen.findByDisplayValue('Dr. Jane Smith')
    fireEvent.change(nameInput, { target: { value: 'Dr. Jane Doe' } })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith('/profile', {
        full_name: 'Dr. Jane Doe',
        department: 'Computer Science',
        designation: 'Associate Professor',
        expertise: ['ML'],
      })
    )
    expect(useAuthStore.getState().user?.full_name).toBe('Dr. Jane Doe')
    expect(toastMock.success).toHaveBeenCalledWith('Profile updated successfully')
  })

  it('changes the password from the password section', async () => {
    apiMock.get.mockResolvedValueOnce(profileResponse)
    apiMock.post.mockResolvedValueOnce({ data: { message: 'Password changed successfully' } })

    renderPage()

    await screen.findByDisplayValue('Dr. Jane Smith')
    fireEvent.click(screen.getByRole('button', { name: /^password$/i }))
    fireEvent.change(screen.getByPlaceholderText('Your current password'), {
      target: { value: 'OldPassword1' },
    })
    fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), {
      target: { value: 'NewPassword1' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), {
      target: { value: 'NewPassword1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/profile/change-password', {
        current_password: 'OldPassword1',
        new_password: 'NewPassword1',
        confirm_password: 'NewPassword1',
      })
    )
    expect(toastMock.success).toHaveBeenCalledWith('Password changed successfully')
  })
})