import React, { useEffect, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  Upload, FileText, Download, Clock, AlertCircle,
  CheckCircle2, Loader2, Lock, History
} from 'lucide-react'
import { Button, Badge, Alert, Spinner } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'

interface Document {
  id: string
  file_name: string
  file_size_bytes: number
  version: number
  is_latest: boolean
  created_at: string
  uploader_name: string
  plagiarism_status?: string
  similarity_score?: number
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DocumentManagementPage: React.FC = () => {
  const { user } = useAuthStore()
  const isLeader = user?.role === 'student_leader'
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [teamStatus, setTeamStatus] = useState<string>('')

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      const [docsRes, teamRes] = await Promise.all([
        api.get('/student/documents'),
        api.get('/student/team'),
      ])
      setDocuments(docsRes.data)
      setTeamStatus(teamRes.data.status)
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const err = rejectedFiles[0].errors[0]
      if (err.code === 'file-too-large') toast.error('File exceeds 10MB limit')
      else if (err.code === 'file-invalid-type') toast.error('Only PDF files are allowed')
      else toast.error(err.message)
      return
    }

    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      await api.post('/student/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Document uploaded successfully!')
      fetchDocuments()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: !isLeader || teamStatus !== 'approved' || uploading,
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  const latestDoc = documents.find((d) => d.is_latest)
  const historyDocs = documents.filter((d) => !d.is_latest)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-display text-gray-900">Document Management</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isLeader
            ? 'Upload and manage your project synopsis documents.'
            : 'View documents uploaded by your team leader.'}
        </p>
      </div>

      {teamStatus !== 'approved' && (
        <Alert type="warning">
          <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Document management is available only after your team registration is approved.</span>
        </Alert>
      )}

      {/* Upload zone - Leader only */}
      {isLeader && teamStatus === 'approved' && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              Upload New Version
            </h3>
          </div>
          <div className="card-body">
            <div
              {...getRootProps()}
              className={clsx(
                'relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer',
                isDragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/30',
                uploading && 'opacity-60 cursor-not-allowed'
              )}
            >
              <input {...getInputProps()} />

              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  <p className="text-sm font-medium text-gray-700">Uploading document...</p>
                </div>
              ) : isDragActive ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <Upload className="w-7 h-7 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-blue-700">Drop your PDF here</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                    <FileText className="w-7 h-7 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Drag & drop your synopsis PDF
                    </p>
                    <p className="text-xs text-gray-400">or click to browse files</p>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> PDF only
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> Max 10 MB
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> Auto-versioned
                    </span>
                  </div>
                </div>
              )}
            </div>

            {latestDoc && (
              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                Uploading a new file will create version {(latestDoc.version + 1)} and archive the current version.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Latest Document */}
      {latestDoc ? (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Current Document
            </h3>
            <span className="badge bg-blue-100 text-blue-700">Latest • v{latestDoc.version}</span>
          </div>
          <div className="card-body">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{latestDoc.file_name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-400">{formatBytes(latestDoc.file_size_bytes)}</span>
                  <span className="text-gray-200">|</span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(latestDoc.created_at), 'MMM d, yyyy • h:mm a')}
                  </span>
                  <span className="text-gray-200">|</span>
                  <span className="text-xs text-gray-400">by {latestDoc.uploader_name}</span>
                </div>
              </div>
              {latestDoc.plagiarism_status && (
                <div className="text-right">
                  <Badge
                    status={latestDoc.plagiarism_status as any}
                    label={
                      latestDoc.plagiarism_status === 'completed' && latestDoc.similarity_score != null
                        ? `${latestDoc.similarity_score}% similar`
                        : latestDoc.plagiarism_status
                    }
                  />
                </div>
              )}
              <Button variant="secondary" size="sm">
                <Download className="w-3.5 h-3.5" /> Download
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-10 text-center">
          <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No documents uploaded yet.</p>
          {isLeader && teamStatus === 'approved' && (
            <p className="text-gray-400 text-xs mt-1">Use the upload zone above to submit your first document.</p>
          )}
        </div>
      )}

      {/* Version History */}
      {historyDocs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500" />
              Version History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header px-5 py-3 text-left">Version</th>
                  <th className="table-header px-5 py-3 text-left">Filename</th>
                  <th className="table-header px-5 py-3 text-left">Size</th>
                  <th className="table-header px-5 py-3 text-left">Uploaded</th>
                  <th className="table-header px-5 py-3 text-left">By</th>
                  <th className="table-header px-5 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {historyDocs.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">v{doc.version}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 max-w-[200px] truncate">{doc.file_name}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{doc.uploader_name}</td>
                    <td className="px-5 py-3">
                      <Button variant="ghost" size="sm">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentManagementPage
