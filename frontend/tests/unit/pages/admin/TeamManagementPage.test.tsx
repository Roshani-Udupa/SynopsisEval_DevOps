import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TeamManagementPage from '../../../../src/pages/admin/TeamManagementPage'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
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

describe('TeamManagementPage', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
    apiMock.patch.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  it('loads teams and approves a pending registration', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: [
        {
          id: 'team-1',
          team_name: 'Team Alpha',
          status: 'pending',
          leader_name: 'Leader One',
          leader_email: 'leader@example.com',
          member_count: 3,
          guide_name: 'Prof Guide',
          created_at: new Date('2026-05-01T10:00:00Z').toISOString(),
          rejection_note: null,
        },
      ],
    })
    apiMock.patch.mockResolvedValueOnce({ data: { message: 'Team approved' } })

    render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('Team Alpha')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }))

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith('/admin/teams/team-1/status', {
        status: 'approved',
        rejection_note: null,
      })
    )
    expect(toastMock.success).toHaveBeenCalledWith('Team approved successfully')
  })
})