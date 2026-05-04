import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationsPage from '../../../../src/pages/shared/NotificationsPage'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastMock.success,
    error: toastMock.error,
  },
}))

describe('NotificationsPage', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
    apiMock.post.mockReset()
    apiMock.patch.mockReset()
    apiMock.delete.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>
  )

  it('loads unread notifications and marks all as read', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: [
        {
          id: 'note-1',
          title: 'Team approved',
          message: 'Your team was approved.',
          type: 'success',
          is_read: false,
          action_url: '/student',
          created_at: new Date('2026-05-01T10:00:00Z').toISOString(),
        },
        {
          id: 'note-2',
          title: 'Scores released',
          message: 'Your scores are available.',
          type: 'info',
          is_read: true,
          action_url: null,
          created_at: new Date('2026-05-01T11:00:00Z').toISOString(),
        },
      ],
    })
    apiMock.post.mockResolvedValueOnce({ data: { message: 'Updated' } })

    renderPage()

    expect(await screen.findByText('Team approved')).toBeInTheDocument()
    expect(screen.getByText('1 unread notification')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /mark all as read/i }))

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/notifications/mark-all-read'))
    expect(toastMock.success).toHaveBeenCalledWith('All notifications marked as read')
    expect(screen.getByText('All caught up!')).toBeInTheDocument()
  })
})