import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DocumentHubPage from '../../../../src/pages/admin/DocumentHubPage'
import { downloadDocument } from '../../../../src/utils/download'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}))

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

vi.mock('../../../../src/utils/download', () => ({
  downloadDocument: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: toastMock,
}))

describe('DocumentHubPage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    apiMock.get.mockReset()
    apiMock.post.mockReset()
    apiMock.patch.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <DocumentHubPage />
    </MemoryRouter>
  )

  it('filters documents and completes a plagiarism check', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: [
        {
          id: 'doc-1',
          team_name: 'Team Alpha',
          file_name: 'alpha.pdf',
          file_size_bytes: 1024,
          version: 1,
          is_latest: true,
          uploaded_by: 'Leader A',
          created_at: '2026-05-04T09:00:00.000Z',
          plagiarism_status: 'pending',
        },
        {
          id: 'doc-2',
          team_name: 'Team Beta',
          file_name: 'beta.pdf',
          file_size_bytes: 2048,
          version: 2,
          is_latest: true,
          uploaded_by: 'Leader B',
          created_at: '2026-05-04T10:00:00.000Z',
          plagiarism_status: 'completed',
          similarity_score: 14.2,
        },
      ],
    })
    apiMock.post.mockResolvedValueOnce({ data: {} })
    apiMock.patch.mockResolvedValueOnce({ data: {} })

    renderPage()

    expect(await screen.findByText('Document Hub')).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Team Beta')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search by team or filename...'), {
      target: { value: 'Beta' },
    })

    expect(screen.queryByText('Team Alpha')).not.toBeInTheDocument()
    expect(screen.getByText('Team Beta')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search by team or filename...'), {
      target: { value: '' },
    })

    vi.useFakeTimers()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check/i }))
      await Promise.resolve()
    })

    expect(screen.getByText(/analyzing/i)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    expect(apiMock.post).toHaveBeenCalledWith('/admin/documents/doc-1/plagiarism-check')
    expect(apiMock.patch).toHaveBeenCalledWith('/admin/documents/doc-1/plagiarism-result', {
      status: 'completed',
      similarity_score: 9.5,
    })
    expect(toastMock.success).toHaveBeenCalledWith('Plagiarism check complete — 9.5% similarity')
  })
})