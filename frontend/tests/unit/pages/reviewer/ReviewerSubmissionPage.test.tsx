import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ReviewerSubmissionPage from '../../../../src/pages/reviewer/ReviewerSubmissionPage'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { teamId: 'team-1' },
  get: vi.fn(),
  post: vi.fn(),
  downloadDocument: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.params,
  }
})

vi.mock('../../../../src/utils/api', () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
  },
}))

vi.mock('../../../../src/utils/download', () => ({
  downloadDocument: mocks.downloadDocument,
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: mocks.success,
    error: mocks.error,
  },
}))

describe('ReviewerSubmissionPage', () => {
  beforeEach(() => {
    mocks.navigate.mockReset()
    mocks.get.mockReset()
    mocks.post.mockReset()
    mocks.downloadDocument.mockReset()
    mocks.success.mockReset()
    mocks.error.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <ReviewerSubmissionPage />
    </MemoryRouter>
  )

  it('loads the team detail and submits a review', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        team_id: 'team-1',
        team_name: 'Team Alpha',
        team_status: 'approved',
        members: [
          { full_name: 'Leader One', usn: 'USN1', role: 'student_leader' },
          { full_name: 'Member Two', usn: 'USN2', role: 'student_member' },
        ],
        guide: {
          full_name: 'Prof Guide',
          department: 'CSE',
        },
        documents: [
          {
            id: 'doc-1',
            file_name: 'synopsis.pdf',
            file_size_bytes: 102400,
            version: 2,
            is_latest: true,
            uploaded_at: '2026-05-04T09:00:00.000Z',
            uploaded_by: 'Leader One',
            similarity_score: 12.5,
            plagiarism_status: 'completed',
          },
        ],
        existing_score: null,
      },
    })
    mocks.post.mockResolvedValueOnce({ data: {} })

    renderPage()

    expect(await screen.findByRole('heading', { name: /submit review/i })).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()

    const sliders = screen.getAllByRole('slider')
    fireEvent.change(sliders[0], { target: { value: '8' } })
    fireEvent.change(sliders[1], { target: { value: '7' } })
    fireEvent.change(sliders[2], { target: { value: '9' } })
    fireEvent.change(sliders[3], { target: { value: '6' } })

    fireEvent.change(screen.getByPlaceholderText(/provide constructive feedback/i), {
      target: { value: 'Solid work' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit review/i }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/reviewer/scores', {
      team_id: 'team-1',
      relevance_score: 8,
      methodology_score: 7,
      presentation_score: 9,
      innovation_score: 6,
      feedback_text: 'Solid work',
    }))
    expect(mocks.success).toHaveBeenCalledWith('Review submitted!')
    expect(await screen.findByText('Review Submitted!')).toBeInTheDocument()
    expect(screen.getByText('30.0')).toBeInTheDocument()
  })
})