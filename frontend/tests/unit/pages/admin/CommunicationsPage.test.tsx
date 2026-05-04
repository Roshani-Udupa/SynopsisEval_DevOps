import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CommunicationsPage from '../../../../src/pages/admin/CommunicationsPage'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
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

describe('CommunicationsPage', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
    apiMock.post.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <CommunicationsPage />
    </MemoryRouter>
  )

  it('loads email logs, fills a template, and sends a message', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: [
        {
          id: 'log-1',
          recipient_type: 'pending_teams',
          subject: 'Existing update',
          status: 'sent',
          sent_at: '2026-05-04T09:00:00.000Z',
          created_at: '2026-05-04T09:00:00.000Z',
        },
      ],
    })
    apiMock.post.mockResolvedValueOnce({
      data: {
        id: 'log-2',
        recipient_type: 'all_reviewers',
        subject: 'Your Team Registration Has Been Approved',
        status: 'sent',
        sent_at: '2026-05-04T11:00:00.000Z',
        created_at: '2026-05-04T11:00:00.000Z',
      },
    })

    renderPage()

    expect(await screen.findByText('Communications')).toBeInTheDocument()
    expect(screen.getByText('Existing update')).toBeInTheDocument()

    const [templateSelect, recipientSelect] = screen.getAllByRole('combobox')

    fireEvent.change(templateSelect, { target: { value: 'approval' } })
    fireEvent.change(recipientSelect, { target: { value: 'all_reviewers' } })

    expect(screen.getByPlaceholderText('Email subject...')).toHaveValue('Your Team Registration Has Been Approved')
    expect((screen.getByPlaceholderText('Type your message here...') as HTMLTextAreaElement).value).toContain('Dear Team')

    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/admin/communications/send', {
      recipient_type: 'all_reviewers',
      subject: 'Your Team Registration Has Been Approved',
      body: expect.stringContaining('Dear Team'),
      template_used: 'approval',
    }))
    expect(toastMock.success).toHaveBeenCalledWith('Message sent and logged!')
    expect(screen.getByText('Your Team Registration Has Been Approved')).toBeInTheDocument()
  })
})