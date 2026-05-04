import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ScoreDashboardPage from '../../../../src/pages/admin/ScoreDashboardPage'

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
  default: toastMock,
}))

describe('ScoreDashboardPage', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
    apiMock.patch.mockReset()
    apiMock.post.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <ScoreDashboardPage />
    </MemoryRouter>
  )

  it('toggles score release and publishes all scores', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: [
        {
          team_id: 'team-1',
          team_name: 'Team Alpha',
          scores_released: false,
          reviewer_scores: [
            { reviewer_name: 'Prof A', total_score: 31 },
          ],
          average_score: 31,
          document_count: 2,
          plagiarism_done: true,
        },
        {
          team_id: 'team-2',
          team_name: 'Team Beta',
          scores_released: true,
          reviewer_scores: [],
          average_score: 29,
          document_count: 1,
          plagiarism_done: false,
        },
        {
          team_id: 'team-3',
          team_name: 'Team Gamma',
          scores_released: false,
          reviewer_scores: [],
          average_score: null,
          document_count: 1,
          plagiarism_done: true,
        },
      ],
    })
    apiMock.patch.mockResolvedValueOnce({ data: {} })
    apiMock.post.mockResolvedValueOnce({ data: {} })

    renderPage()

    expect(await screen.findByText('Score Release Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Team Beta')).toBeInTheDocument()

    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0])

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledWith('/admin/teams/team-1/release-scores', {
      scores_released: true,
    }))
    expect(toastMock.success).toHaveBeenCalledWith('Scores published for team')

    fireEvent.click(screen.getByRole('button', { name: /publish all scores/i }))

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/admin/score-dashboard/publish-all'))
    expect(toastMock.success).toHaveBeenCalledWith('Scores published for all teams!')
  })
})