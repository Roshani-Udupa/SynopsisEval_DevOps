import api from './api'

const DEFAULT_FILENAME = 'document.pdf'

const filenameFromContentDisposition = (header?: string) => {
  if (!header) return null

  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(header)
  if (!match) return null

  const rawValue = match[1] || match[2]
  if (!rawValue) return null

  try {
    return decodeURIComponent(rawValue)
  } catch {
    return rawValue
  }
}

export async function downloadDocument(documentId: string, fileName?: string) {
  const response = await api.get(`/documents/${documentId}/download`, {
    responseType: 'blob',
  })
  const contentDisposition = response.headers['content-disposition'] as string | undefined;
  const resolvedFileName =
    fileName || filenameFromContentDisposition(response.headers['content-disposition']) || DEFAULT_FILENAME
  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/pdf',
  })

  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = resolvedFileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000)
}
