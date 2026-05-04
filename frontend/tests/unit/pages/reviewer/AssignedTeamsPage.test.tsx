import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AssignedTeamsPage from '../../../../src/pages/reviewer/AssignedTeamsPage'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

const downloadMock = vi.hoisted(() => ({
  downloadDocument: vi.fn(),
}))

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../../../../src/utils/api', () => ({
  default: apiMock,
}))

vi.mock('../../../../src/utils/download', () => downloadMock)

vi.mock('react-hot-toast', () => ({
  default: toastMock,
}))

describe('AssignedTeamsPage', () => {
  beforeEach(() => {
    apiMock.get.mockReset()
    downloadMock.downloadDocument.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  const renderPage = () => render(
    <MemoryRouter>
      <AssignedTeamsPage />
    </MemoryRouter>
  )

  it('filters assigned teams and downloads the document', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: [
        {
          team_id: 'team-1',
          team_name: 'Team Alpha',
          team_status: 'approved',
          member_count: 3,
          has_document: true,
          document_id: 'doc-1',
          document_name: 'alpha.pdf',
          document_version: 2,
          document_uploaded_at: '2026-05-04T09:00:00.000Z',
          similarity_score: 12.4,
          already_reviewed: false,
          assigned_at: '2026-05-03T09:00:00.000Z',
        },
        {
          team_id: 'team-2',
          team_name: 'Team Beta',
          team_status: 'approved',
          member_count: 4,
          has_document: true,
          document_id: 'doc-2',
          document_name: 'beta.pdf',
          document_version: 1,
          document_uploaded_at: '2026-05-04T10:00:00.000Z',
          similarity_score: 45.1,
          already_reviewed: true,
          assigned_at: '2026-05-03T10:00:00.000Z',
        },
      ],
    })

    renderPage()

    expect(await screen.findByText('Assigned Teams')).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Team Beta')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search teams...'), {
      target: { value: 'Beta' },
    })

    expect(screen.queryByText('Team Alpha')).not.toBeInTheDocument()
    expect(screen.getByText('Team Beta')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /reviewed/i }))
    expect(screen.getByText('Team Beta')).toBeInTheDocument()
    expect(screen.queryByText('Team Alpha')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))

    await waitFor(() => expect(downloadMock.downloadDocument).toHaveBeenCalledWith('doc-2', 'beta.pdf'))
  })
})