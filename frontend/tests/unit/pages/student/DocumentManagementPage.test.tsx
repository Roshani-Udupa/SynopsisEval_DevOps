import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../../../../src/store/authStore'
import DocumentManagementPage from '../../../../src/pages/student/DocumentManagementPage'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
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

describe('DocumentManagementPage', () => {
  beforeEach(() => {
    localStorage.clear()
    apiMock.get.mockReset()
    apiMock.post.mockReset()
    downloadMock.downloadDocument.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
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
      <DocumentManagementPage />
    </MemoryRouter>
  )

  it('uploads a new synopsis version and downloads the current document', async () => {
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/student/documents') {
        return Promise.resolve({
          data: [
            {
              id: 'doc-1',
              file_name: 'synopsis-v2.pdf',
              file_size_bytes: 102400,
              version: 2,
              is_latest: true,
              created_at: '2026-05-04T09:00:00.000Z',
              uploader_name: 'Asha Kumar',
              plagiarism_status: 'completed',
              similarity_score: 12.5,
            },
            {
              id: 'doc-0',
              file_name: 'synopsis-v1.pdf',
              file_size_bytes: 92160,
              version: 1,
              is_latest: false,
              created_at: '2026-05-01T09:00:00.000Z',
              uploader_name: 'Asha Kumar',
            },
          ],
        })
      }

      if (url === '/student/team') {
        return Promise.resolve({
          data: {
            status: 'approved',
          },
        })
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })
    apiMock.post.mockResolvedValueOnce({ data: {} })

    const { container } = renderPage()

    expect(await screen.findByText('Document Management')).toBeInTheDocument()
    expect(screen.getByText('synopsis-v2.pdf')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /download/i })[0])
    await waitFor(() => expect(downloadMock.downloadDocument).toHaveBeenCalledWith('doc-1', 'synopsis-v2.pdf'))

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const nextVersion = new File(['%PDF-1.4'], 'synopsis-v3.pdf', { type: 'application/pdf' })

    fireEvent.change(fileInput, { target: { files: [nextVersion] } })

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/student/documents/upload', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
    expect(toastMock.success).toHaveBeenCalledWith('Document uploaded successfully!')
  })
})