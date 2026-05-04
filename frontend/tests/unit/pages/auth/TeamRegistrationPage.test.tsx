import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TeamRegistrationPage from '../../../../src/pages/auth/TeamRegistrationPage'

const apiMock = vi.hoisted(() => ({
  post: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

describe('TeamRegistrationPage', () => {
  beforeEach(() => {
    apiMock.post.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <TeamRegistrationPage />
    </MemoryRouter>
  )

  it('walks through the registration steps and submits the payload', async () => {
    apiMock.post.mockResolvedValueOnce({ data: {} })

    renderPage()

    fireEvent.change(screen.getByPlaceholderText('e.g., Neural Nexus'), {
      target: { value: 'Neural Nexus' },
    })
    fireEvent.change(screen.getByPlaceholderText("Leader's full name"), {
      target: { value: 'Asha Kumar' },
    })
    fireEvent.change(screen.getByPlaceholderText('leader@example.com'), {
      target: { value: 'leader@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g., 1MS23CS001'), {
      target: { value: '1MS23CS001' },
    })
    fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), {
      target: { value: 'Leader123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    expect(await screen.findByText('Members')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("Member's name"), {
      target: { value: 'Ravi Kumar' },
    })
    fireEvent.change(screen.getByPlaceholderText('member@example.com'), {
      target: { value: 'member@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g., 1MS23CS002'), {
      target: { value: '1MS23CS002' },
    })
    fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), {
      target: { value: 'Member123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    expect(await screen.findByText('Guide')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Prof. John Doe'), {
      target: { value: 'Prof. John Doe' },
    })
    fireEvent.change(screen.getByPlaceholderText('guide@university.edu'), {
      target: { value: 'guide@university.edu' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g., Computer Science'), {
      target: { value: 'Computer Science' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    expect(await screen.findByText('Review')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /submit registration/i }))

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/auth/register/team', {
      team_name: 'Neural Nexus',
      leader_name: 'Asha Kumar',
      leader_email: 'leader@example.com',
      leader_usn: '1MS23CS001',
      leader_password: 'Leader123',
      members: [
        {
          full_name: 'Ravi Kumar',
          email: 'member@example.com',
          usn: '1MS23CS002',
          password: 'Member123',
        },
      ],
      guide: {
        full_name: 'Prof. John Doe',
        email: 'guide@university.edu',
        department: 'Computer Science',
      },
    }))
    expect(await screen.findByText('Registration Submitted!')).toBeInTheDocument()
    expect(screen.getByText('Neural Nexus')).toBeInTheDocument()
  })
})