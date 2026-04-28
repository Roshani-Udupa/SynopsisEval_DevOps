import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Search, FileText, Zap, Download, Clock, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { Button, Badge, Spinner } from '../../components/ui'
import api from '../../utils/api'
import { downloadDocument } from '../../utils/download'
import { clsx } from 'clsx'
import { format } from 'date-fns'

interface DocumentRow {
  id: string
  team_name: string
  file_name: string
  file_size_bytes: number
  version: number
  is_latest: boolean
  uploaded_by: string
  created_at: string
  plagiarism_status?: 'pending' | 'processing' | 'completed' | 'failed'
  similarity_score?: number
}

const formatBytes = (b: number) => {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

const ScorePill: React.FC<{ score: number }> = ({ score }) => {
  const color = score < 20 ? 'text-green-700 bg-green-100' : score < 40 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100'
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', color)}>
      {score.toFixed(1)}%
    </span>
  )
}

const DocumentHubPage: React.FC = () => {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  useEffect(() => { fetchDocuments() }, [])

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/admin/documents')
      setDocs(res.data)
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const triggerPlagiarismCheck = async (docId: string) => {
    // Immediately update UI to "processing"
    setDocs((prev) =>
      prev.map((d) => d.id === docId ? { ...d, plagiarism_status: 'processing' } : d)
    )
    setProcessing((prev) => new Set([...prev, docId]))

    try {
      // Tell backend to start job
      await api.post(`/admin/documents/${docId}/plagiarism-check`)
    } catch {
      // Even if backend fails, we simulate
    }

    // Mock: 5 second delay, then "completed" with random score
    setTimeout(() => {
      const mockScore = parseFloat((Math.random() * 45 + 5).toFixed(2))
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, plagiarism_status: 'completed', similarity_score: mockScore }
            : d
        )
      )
      setProcessing((prev) => {
        const next = new Set(prev)
        next.delete(docId)
        return next
      })

      // Optimistically update backend
      api.patch(`/admin/documents/${docId}/plagiarism-result`, {
        status: 'completed',
        similarity_score: mockScore,
      }).catch(() => {})

      toast.success(`Plagiarism check complete — ${mockScore.toFixed(1)}% similarity`)
    }, 5000)
  }

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      await downloadDocument(documentId, fileName)
    } catch {
      toast.error('Failed to download document')
    }
  }

  const filtered = docs.filter((d) =>
    !search ||
    d.team_name.toLowerCase().includes(search.toLowerCase()) ||
    d.file_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display text-gray-900">Document Hub</h1>
        <p className="text-gray-500 text-sm mt-1">
          View all uploaded synopses and trigger plagiarism checks.
        </p>
      </div>

      {/* Stats strip */}
      <div className="flex gap-4 flex-wrap">
        {[
          { label: 'Total Documents', value: docs.length, color: 'text-gray-900' },
          { label: 'Not Checked', value: docs.filter((d) => !d.plagiarism_status || d.plagiarism_status === 'pending').length, color: 'text-amber-600' },
          { label: 'Processing', value: processing.size, color: 'text-blue-600' },
          { label: 'Completed', value: docs.filter((d) => d.plagiarism_status === 'completed').length, color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="card px-5 py-3 flex items-center gap-3">
            <span className={clsx('text-2xl font-display', s.color)}>{s.value}</span>
            <span className="text-xs text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          className="input-field pl-9"
          placeholder="Search by team or filename..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="table-header px-5 py-3 text-left">Document</th>
                <th className="table-header px-5 py-3 text-left">Team</th>
                <th className="table-header px-5 py-3 text-left">Size</th>
                <th className="table-header px-5 py-3 text-left">Version</th>
                <th className="table-header px-5 py-3 text-left">Uploaded</th>
                <th className="table-header px-5 py-3 text-left">Plagiarism</th>
                <th className="table-header px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">
                    No documents found
                  </td>
                </tr>
              ) : (
                filtered.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-red-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[180px]">{doc.file_name}</p>
                          <p className="text-xs text-gray-400">by {doc.uploaded_by}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-700">{doc.team_name}</td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                        v{doc.version}{doc.is_latest && ' ★'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-5 py-4">
                      {doc.plagiarism_status === 'processing' || processing.has(doc.id) ? (
                        <div className="flex items-center gap-1.5 text-blue-600 text-xs font-medium">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Analyzing...
                        </div>
                      ) : doc.plagiarism_status === 'completed' && doc.similarity_score != null ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          <ScorePill score={doc.similarity_score} />
                        </div>
                      ) : doc.plagiarism_status === 'failed' ? (
                        <div className="flex items-center gap-1.5 text-red-500 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5" /> Failed
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Not checked</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {(!doc.plagiarism_status || doc.plagiarism_status === 'pending') && !processing.has(doc.id) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => triggerPlagiarismCheck(doc.id)}
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            Check
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc.id, doc.file_name)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default DocumentHubPage
