import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ReviewerRegistrationPage from '../../../../src/pages/auth/ReviewerRegistrationPage'

const apiMock = vi.hoisted(() => ({
  post: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

describe('ReviewerRegistrationPage', () => {
  beforeEach(() => {
    apiMock.post.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <ReviewerRegistrationPage />
    </MemoryRouter>
  )

  it('submits a reviewer application with selected expertise', async () => {
    apiMock.post.mockResolvedValueOnce({ data: {} })

    renderPage()

    fireEvent.change(screen.getByPlaceholderText('Dr. Jane Smith'), {
      target: { value: 'Dr. Jane Smith' },
    })
    fireEvent.change(screen.getByPlaceholderText('you@university.edu'), {
      target: { value: 'jane@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g., Computer Science'), {
      target: { value: 'Computer Science' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g., Associate Professor'), {
      target: { value: 'Associate Professor' },
    })
    fireEvent.click(screen.getByRole('button', { name: /machine learning/i }))
    fireEvent.click(screen.getByRole('button', { name: /^nlp$/i }))
    fireEvent.change(screen.getAllByPlaceholderText('Min. 8 characters')[0], {
      target: { value: 'Password1' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter password'), {
      target: { value: 'Password1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }))

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/auth/register/reviewer', {
      full_name: 'Dr. Jane Smith',
      email: 'jane@example.com',
      password: 'Password1',
      department: 'Computer Science',
      designation: 'Associate Professor',
      expertise: ['Machine Learning', 'NLP'],
    }))
    expect(await screen.findByText('Application Submitted!')).toBeInTheDocument()
  })
})