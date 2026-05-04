import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadDocument } from '../../../src/utils/download'

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('../../../src/utils/api', () => ({
  default: apiMock,
}))

describe('downloadDocument', () => {
  let appendSpy: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.spyOn>
  let removeSpy: ReturnType<typeof vi.spyOn>
  const createObjectUrlMock = vi.fn(() => 'blob:mock-url')
  const revokeObjectUrlMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    apiMock.get.mockReset()
    createObjectUrlMock.mockClear()
    revokeObjectUrlMock.mockClear()

    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    })

    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    })

    appendSpy = vi.spyOn(document.body, 'appendChild')
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    removeSpy = vi.spyOn(HTMLAnchorElement.prototype, 'remove').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('uses an explicit filename when one is provided', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: new Blob(['test file'], { type: 'application/octet-stream' }),
      headers: {
        'content-disposition': 'attachment; filename="ignored.pdf"',
        'content-type': 'application/octet-stream',
      },
    })

    await downloadDocument('doc-1', 'custom-name.pdf')
    vi.advanceTimersByTime(1000)

    expect(apiMock.get).toHaveBeenCalledWith('/documents/doc-1/download', { responseType: 'blob' })
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1)
    expect((createObjectUrlMock.mock.calls[0][0] as Blob).type).toBe('application/octet-stream')
    expect(appendSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:mock-url')

    const link = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(link.download).toBe('custom-name.pdf')
  })

  it('decodes the filename from content disposition when no filename is passed', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: new Blob(['report'], { type: 'text/plain' }),
      headers: {
        'content-disposition': "attachment; filename*=UTF-8''team%20report.pdf",
        'content-type': 'text/plain',
      },
    })

    await downloadDocument('doc-2')
    vi.advanceTimersByTime(1000)

    expect(appendSpy).toHaveBeenCalledTimes(1)
    expect((createObjectUrlMock.mock.calls[0][0] as Blob).type).toBe('text/plain')

    const link = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(link.download).toBe('team report.pdf')
  })

  it('falls back to the default filename when no header is present', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: new Blob(['fallback']),
      headers: {},
    })

    await downloadDocument('doc-3')
    vi.advanceTimersByTime(1000)

    expect(appendSpy).toHaveBeenCalledTimes(1)
    expect((createObjectUrlMock.mock.calls[0][0] as Blob).type).toBe('application/pdf')

    const link = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(link.download).toBe('document.pdf')
  })
})