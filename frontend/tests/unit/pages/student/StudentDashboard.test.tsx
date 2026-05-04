import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../../../../src/store/authStore'
import StudentDashboard from '../../../../src/pages/student/StudentDashboard'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

describe('StudentDashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    apiMock.get.mockReset()
    useAuthStore.setState({
      user: {
        user_id: 'student-1',
        role: 'student_leader',
        full_name: 'Asha Kumar',
        status: 'approved',
        access_token: 'token-123',
      },
    })
  })

  const renderPage = () => render(
    <MemoryRouter>
      <StudentDashboard />
    </MemoryRouter>
  )

  it('renders an approved team dashboard with released scores', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        id: 'team-1',
        team_name: 'Team Alpha',
        status: 'approved',
        scores_released: true,
        created_at: '2026-05-01T09:00:00.000Z',
        members: [
          { full_name: 'Asha Kumar', usn: 'USN1', role: 'student_leader' },
          { full_name: 'Ravi Kumar', usn: 'USN2', role: 'student_member' },
        ],
        guide: {
          full_name: 'Prof Guide',
          department: 'CSE',
        },
        latest_document: {
          file_name: 'synopsis.pdf',
          created_at: '2026-05-04T09:00:00.000Z',
          version: 2,
        },
      },
    })

    renderPage()

    expect(await screen.findByText(/Welcome back, Asha/i)).toBeInTheDocument()
    expect(screen.getByText('Scores Released!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view results/i })).toHaveAttribute('href', '/student/results')
    expect(screen.getByRole('link', { name: /document management/i })).toHaveAttribute('href', '/student/documents')
    expect(screen.getByText('Prof Guide')).toBeInTheDocument()
  })

  it('shows the empty state when no team exists', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('not found'))

    renderPage()

    expect(await screen.findByText('No team registration found.')).toBeInTheDocument()
    expect(screen.getByText('Please contact your administrator.')).toBeInTheDocument()
  })
})