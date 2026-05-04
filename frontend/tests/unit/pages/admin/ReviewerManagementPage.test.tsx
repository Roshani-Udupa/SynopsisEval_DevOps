import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ReviewerManagementPage from '../../../../src/pages/admin/ReviewerManagementPage'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
}))

describe('ReviewerManagementPage', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
    apiMock.patch.mockReset()
    apiMock.post.mockReset()
    apiMock.delete.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <ReviewerManagementPage />
    </MemoryRouter>
  )

  it('approves a reviewer and assigns them to a team', async () => {
    apiMock.get
      .mockResolvedValueOnce({
        data: [
          {
            id: 'reviewer-pending',
            full_name: 'Pending Reviewer',
            email: 'pending@example.com',
            status: 'pending',
            department: 'CSE',
            designation: 'Assistant Professor',
            expertise: ['ML', 'AI'],
            created_at: '2026-05-01T09:00:00.000Z',
            assigned_teams: [],
          },
          {
            id: 'reviewer-approved',
            full_name: 'Approved Reviewer',
            email: 'approved@example.com',
            status: 'approved',
            department: 'ISE',
            designation: 'Associate Professor',
            expertise: ['NLP', 'DL', 'CV'],
            created_at: '2026-05-02T09:00:00.000Z',
            assigned_teams: [
              { id: 'team-1', team_name: 'Team Alpha' },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'team-1', team_name: 'Team Alpha' },
          { id: 'team-2', team_name: 'Team Beta' },
        ],
      })
    apiMock.patch.mockResolvedValueOnce({ data: {} })
    apiMock.post.mockResolvedValueOnce({ data: {} })

    renderPage()

    expect(await screen.findByText('Reviewer Management')).toBeInTheDocument()

    const pendingRow = screen.getByText('Pending Reviewer').closest('tr')!
    fireEvent.click(within(pendingRow).getByRole('button', { name: /approve/i }))

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledWith('/admin/reviewers/reviewer-pending/approve'))
    expect(toastMock.success).toHaveBeenCalledWith('Reviewer approved')

    const approvedRow = screen.getByText('Approved Reviewer').closest('tr')!
    fireEvent.click(within(approvedRow).getByRole('button', { name: /assign/i }))

    expect(await screen.findByText('Assign Approved Reviewer to a Team')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'team-2' } })
    fireEvent.click(screen.getByRole('button', { name: /assign reviewer/i }))

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/admin/reviewer-assignments', {
      reviewer_id: 'reviewer-approved',
      team_id: 'team-2',
    }))
    expect(toastMock.success).toHaveBeenCalledWith('Assigned to Team Beta')
  })
})