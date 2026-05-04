import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminDashboard from '../../../../src/pages/admin/AdminDashboard'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

describe('AdminDashboard', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  )

  it('renders dashboard stats, pending alerts, and recent activity', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        total_teams: 4,
        pending_teams: 2,
        approved_teams: 2,
        rejected_teams: 0,
        total_reviewers: 3,
        pending_reviewers: 1,
        total_documents: 5,
        plagiarism_completed: 4,
        scores_released_count: 1,
        recent_activity: [
          {
            type: 'team',
            label: 'Team Alpha registered',
            time: '2026-05-04T10:00:00.000Z',
          },
        ],
      },
    })

    renderPage()

    expect(await screen.findByText('Admin Dashboard')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /2 teams awaiting approval/i })).toHaveAttribute('href', '/admin/teams')
    expect(screen.getByText('Team Alpha registered')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /manage teams/i })).toHaveAttribute('href', '/admin/teams')
    expect(screen.getByRole('link', { name: /score dashboard/i })).toHaveAttribute('href', '/admin/scores')
  })

  it('falls back to zero stats when loading fails', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('network down'))

    renderPage()

    expect(await screen.findByText('Admin Dashboard')).toBeInTheDocument()
    expect(screen.getByText('No recent activity yet')).toBeInTheDocument()
    expect(screen.getByText('0 approved')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /manage reviewers/i })).toHaveAttribute('href', '/admin/reviewers')
  })
})