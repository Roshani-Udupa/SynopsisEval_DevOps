import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ReviewerDashboard from '../../../../src/pages/reviewer/ReviewerDashboard'
import { useAuthStore } from '../../../../src/store/authStore'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

describe('ReviewerDashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: {
        user_id: 'reviewer-1',
        role: 'reviewer',
        full_name: 'Dr. Jane Smith',
        status: 'approved',
        access_token: 'token-123',
      },
    })
    apiMock.get.mockReset()
  })

  it('renders reviewer stats and recent submissions', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        total_assigned: 3,
        reviewed_count: 2,
        pending_count: 1,
        department: 'Computer Science',
        designation: 'Associate Professor',
        expertise: ['ML', 'NLP'],
        recent_reviews: [
          {
            team_name: 'Team Alpha',
            total_score: 31,
            submitted_at: new Date('2026-05-01T10:00:00Z').toISOString(),
          },
        ],
      },
    })

    render(
      <MemoryRouter>
        <ReviewerDashboard />
      </MemoryRouter>
    )

    expect(await screen.findByText(/Welcome,/i)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /team awaiting your review/i })).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
  })
})