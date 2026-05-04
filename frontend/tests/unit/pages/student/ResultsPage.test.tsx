import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ResultsPage from '../../../../src/pages/student/ResultsPage'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

describe('ResultsPage', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <ResultsPage />
    </MemoryRouter>
  )

  it('shows the locked state when scores are not released', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        scores_released: false,
        team_name: 'Team Alpha',
        scores: [],
      },
    })

    renderPage()

    expect(await screen.findByText('Results Not Yet Released')).toBeInTheDocument()
    expect(screen.getByText(/your review scores haven't been published/i)).toBeInTheDocument()
  })

  it('renders released scores and plagiarism details', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        scores_released: true,
        team_name: 'Team Alpha',
        scores: [
          {
            reviewer_name: 'Prof A',
            relevance_score: 8,
            methodology_score: 7,
            presentation_score: 9,
            innovation_score: 6,
            total_score: 30,
            feedback_text: 'Good work',
          },
        ],
        averages: {
          relevance: 8,
          methodology: 7,
          presentation: 9,
          innovation: 6,
          total: 30,
        },
        plagiarism_status: 'completed',
        similarity_score: 12.5,
      },
    })

    renderPage()

    expect(await screen.findByText(/Review scores for/i)).toBeInTheDocument()
    expect(screen.getByText('Aggregate Scores')).toBeInTheDocument()
    expect(screen.getByText('Reviewer 1')).toBeInTheDocument()
    const similarityLabel = screen.getByText(/similarity detected/i)
    expect(similarityLabel.closest('p')).toHaveTextContent('12.5')
    expect(screen.getByText('Good work')).toBeInTheDocument()
  })
})