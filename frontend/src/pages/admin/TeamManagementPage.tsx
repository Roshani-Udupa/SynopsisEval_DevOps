import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Search, CheckCircle2, XCircle, Eye, ChevronDown,
  Users, Filter
} from 'lucide-react'
import { Button, Badge, Modal, Spinner, Alert } from '../../components/ui'
import api from '../../utils/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'

interface Team {
  id: string
  team_name: string
  status: 'pending' | 'approved' | 'rejected'
  leader_name: string
  leader_email: string
  member_count: number
  guide_name?: string
  created_at: string
  rejection_note?: string
}

const TeamManagementPage: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [search, setSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => { fetchTeams() }, [])

  const fetchTeams = async () => {
    try {
      const res = await api.get('/admin/teams')
      setTeams(res.data)
    } catch {
      toast.error('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (teamId: string, status: 'approved' | 'rejected', note?: string) => {
    setActionLoading(teamId + status)
    try {
      await api.patch(`/admin/teams/${teamId}/status`, { status, rejection_note: note || null })
      toast.success(`Team ${status} successfully`)
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId ? { ...t, status, rejection_note: note } : t
        )
      )
      setShowRejectModal(false)
      setRejectNote('')
      setSelectedTeam(null)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = (team: Team) => {
    setSelectedTeam(team)
    setShowRejectModal(true)
  }

  const filtered = teams.filter((t) => {
    const matchStatus = filter === 'all' || t.status === filter
    const matchSearch =
      !search ||
      t.team_name.toLowerCase().includes(search.toLowerCase()) ||
      t.leader_name.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const counts = {
    all: teams.length,
    pending: teams.filter((t) => t.status === 'pending').length,
    approved: teams.filter((t) => t.status === 'approved').length,
    rejected: teams.filter((t) => t.status === 'rejected').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display text-gray-900">Team Management</h1>
        <p className="text-gray-500 text-sm mt-1">Review, approve, or reject team registrations.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-9"
            placeholder="Search teams or leaders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
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
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={clsx('ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                filter === f ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              )}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="table-header px-5 py-3 text-left">Team</th>
                <th className="table-header px-5 py-3 text-left">Leader</th>
                <th className="table-header px-5 py-3 text-left">Members</th>
                <th className="table-header px-5 py-3 text-left">Guide</th>
                <th className="table-header px-5 py-3 text-left">Registered</th>
                <th className="table-header px-5 py-3 text-left">Status</th>
                <th className="table-header px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">
                    No teams found
                  </td>
                </tr>
              ) : (
                filtered.map((team) => (
                  <tr key={team.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="font-semibold text-gray-900">{team.team_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-700">{team.leader_name}</p>
                      <p className="text-xs text-gray-400">{team.leader_email}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-500">{team.member_count}</td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{team.guide_name || '—'}</td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {format(new Date(team.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-5 py-4">
                      <Badge status={team.status} />
                    </td>
                    <td className="px-5 py-4">
                      {team.status === 'pending' ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            loading={actionLoading === team.id + 'approved'}
                            onClick={() => updateStatus(team.id, 'approved')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleReject(team)}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {team.status === 'approved' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={actionLoading === team.id + 'rejected'}
                              onClick={() => handleReject(team)}
                            >
                              Revoke
                            </Button>
                          )}
                          {team.status === 'rejected' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={actionLoading === team.id + 'approved'}
                              onClick={() => updateStatus(team.id, 'approved')}
                            >
                              Re-approve
                            </Button>
                          )}
                          {team.rejection_note && (
                            <span className="text-xs text-red-500" title={team.rejection_note}>
                              Note ⓘ
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      <Modal
        open={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectNote('') }}
        title={`Reject Team: ${selectedTeam?.team_name}`}
      >
        <div className="space-y-4">
          <Alert type="warning">
            <span>This will deny the team's access to the portal. You can re-approve later.</span>
          </Alert>
          <div>
            <label className="label">Rejection Reason (optional)</label>
            <textarea
              className="input-field resize-none h-24"
              placeholder="Provide a reason for rejection..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={!!actionLoading}
              onClick={() => selectedTeam && updateStatus(selectedTeam.id, 'rejected', rejectNote)}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default TeamManagementPage
