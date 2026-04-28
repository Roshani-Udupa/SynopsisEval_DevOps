import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Users, FileText, CheckCircle2, Clock, ArrowRight,
  Search, Download, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { Spinner, Badge } from '../../components/ui'
import api from '../../utils/api'
import { downloadDocument } from '../../utils/download'
import { clsx } from 'clsx'
import { format } from 'date-fns'

interface AssignedTeam {
  team_id: string
  team_name: string
  team_status: string
  member_count: number
  has_document: boolean
  document_id: string | null
  document_name: string | null
  document_version: number | null
  document_uploaded_at: string | null
  similarity_score: number | null
  already_reviewed: boolean
  assigned_at: string
}

const SimilarityBadge: React.FC<{ score: number }> = ({ score }) => {
  const color = score < 20
    ? 'bg-green-100 text-green-700'
    : score < 40
    ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'
  const icon = score < 20
    ? <ShieldCheck className="w-3 h-3" />
    : <AlertTriangle className="w-3 h-3" />
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', color)}>
      {icon} {score.toFixed(1)}% similarity
    </span>
  )
}

const AssignedTeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<AssignedTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

  useEffect(() => { fetchTeams() }, [])

  const fetchTeams = async () => {
    try {
      const res = await api.get('/reviewer/assigned-teams')
      setTeams(res.data)
    } catch {
      setTeams([])
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      await downloadDocument(documentId, fileName)
    } catch {
      toast.error('Failed to download document')
    }
  }

  const filtered = teams.filter((t) => {
    const matchSearch = !search || t.team_name.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ||
      (filter === 'pending' && !t.already_reviewed) ||
      (filter === 'done' && t.already_reviewed)
    return matchSearch && matchFilter
  })

  const pendingCount = teams.filter((t) => !t.already_reviewed).length
  const doneCount = teams.filter((t) => t.already_reviewed).length

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-display text-gray-900">Assigned Teams</h1>
        <p className="text-gray-500 text-sm mt-1">
          Teams you are responsible for reviewing this cycle.
        </p>
      </div>

      {/* Summary strip */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Total Assigned', value: teams.length, color: 'text-gray-900' },
          { label: 'Pending', value: pendingCount, color: 'text-amber-600' },
          { label: 'Reviewed', value: doneCount, color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="card px-5 py-3 flex items-center gap-3">
            <span className={clsx('text-2xl font-display', s.color)}>{s.value}</span>
            <span className="text-xs text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-9"
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-3 py-2 rounded-xl text-xs font-medium border transition-all',
                filter === f
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              )}
            >
              {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Reviewed'}
            </button>
          ))}
        </div>
      </div>

      {/* Team cards */}
      {filtered.length === 0 ? (
        <div className="card p-14 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No teams found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((team) => (
            <div key={team.team_id} className="card hover:shadow-md transition-all duration-200">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={clsx(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      team.already_reviewed ? 'bg-green-100' : 'bg-blue-100'
                    )}>
                      {team.already_reviewed
                        ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                        : <Clock className="w-5 h-5 text-blue-600" />
                      }
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{team.team_name}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <span className="text-xs text-gray-400">{team.member_count} members</span>
                        <span className="text-gray-200">·</span>
                        <span className="text-xs text-gray-400">
                          Assigned {format(new Date(team.assigned_at), 'MMM d, yyyy')}
                        </span>
                        {team.similarity_score !== null && (
                          <>
                            <span className="text-gray-200">·</span>
                            <SimilarityBadge score={team.similarity_score} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {team.already_reviewed ? (
                      <span className="badge-approved">Reviewed</span>
                    ) : (
                      <span className="badge-pending">Pending</span>
                    )}
                  </div>
                </div>

                {/* Document info */}
                <div className="mt-4 flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {team.has_document ? (
                      <div>
                        <p className="text-xs font-medium text-gray-700 truncate max-w-[200px]">
                          {team.document_name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          v{team.document_version} · Uploaded {team.document_uploaded_at
                            ? format(new Date(team.document_uploaded_at), 'MMM d')
                            : '—'
                          }
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">No document uploaded yet</p>
                    )}
                  </div>
                  {team.has_document && (
                    <button
                      className="btn-ghost text-xs py-1"
                      onClick={() => team.document_id && handleDownload(team.document_id, team.document_name || 'document.pdf')}
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-3">
                  <Link
                    to={`/reviewer/submit-review/${team.team_id}`}
                    className={clsx(
                      'btn-primary text-sm flex-1 justify-center',
                      !team.has_document && 'opacity-50 pointer-events-none'
                    )}
                  >
                    {team.already_reviewed ? (
                      <><CheckCircle2 className="w-4 h-4" /> Edit Review</>
                    ) : (
                      <><Star className="w-4 h-4" /> Submit Review</>
                    )}
                  </Link>
                  <Link
                    to={`/reviewer/submit-review/${team.team_id}`}
                    className="btn-secondary text-sm"
                  >
                    View Details <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Star import for JSX usage in component
const Star: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
)

export default AssignedTeamsPage