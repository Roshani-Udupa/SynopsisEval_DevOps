import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SubmittedReviewsPage from '../../../../src/pages/reviewer/SubmittedReviewsPage'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

describe('SubmittedReviewsPage', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <SubmittedReviewsPage />
    </MemoryRouter>
  )

  it('expands a review card and shows the breakdown', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: [
        {
          team_id: 'team-1',
          team_name: 'Team Alpha',
          relevance_score: 8,
          methodology_score: 7,
          presentation_score: 9,
          innovation_score: 6,
          total_score: 30,
          feedback_text: 'Strong submission',
          submitted_at: '2026-05-04T09:00:00.000Z',
          updated_at: '2026-05-04T09:00:00.000Z',
        },
        {
          team_id: 'team-2',
          team_name: 'Team Beta',
          relevance_score: 7,
          methodology_score: 6,
          presentation_score: 8,
          innovation_score: 7,
          total_score: 28,
          feedback_text: null,
          submitted_at: '2026-05-03T09:00:00.000Z',
          updated_at: '2026-05-03T10:00:00.000Z',
        },
      ],
    })

    renderPage()

    expect(await screen.findByText('My Submitted Reviews')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Team Alpha'))

    expect(await screen.findByText('Score Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Strong submission')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /edit review/i })).toHaveAttribute('href', '/reviewer/submit-review/team-1')
  })
})