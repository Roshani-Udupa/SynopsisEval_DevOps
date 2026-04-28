import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Search, CheckCircle2, Star, UserPlus, X } from 'lucide-react'
import { Button, Badge, Modal, Spinner, Alert, Select } from '../../components/ui'
import api from '../../utils/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'

interface Reviewer {
  id: string
  full_name: string
  email: string
  status: 'pending' | 'approved' | 'rejected'
  department?: string
  designation?: string
  expertise?: string[]
  created_at: string
  assigned_teams: { id: string; team_name: string }[]
}

interface Team {
  id: string
  team_name: string
}

const ReviewerManagementPage: React.FC = () => {
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [search, setSearch] = useState('')
  const [assignModal, setAssignModal] = useState<Reviewer | null>(null)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [rRes, tRes] = await Promise.all([
        api.get('/admin/reviewers'),
        api.get('/admin/teams?status=approved'),
      ])
      setReviewers(rRes.data)
      setTeams(tRes.data)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const approveReviewer = async (reviewerId: string) => {
    setActionLoading(reviewerId)
    try {
      await api.patch(`/admin/reviewers/${reviewerId}/approve`)
      toast.success('Reviewer approved')
      setReviewers((prev) =>
        prev.map((r) => r.id === reviewerId ? { ...r, status: 'approved' } : r)
      )
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to approve')
    } finally {
      setActionLoading(null)
    }
  }

  const assignToTeam = async () => {
    if (!assignModal || !selectedTeam) return
    setActionLoading('assign')
    try {
      await api.post('/admin/reviewer-assignments', {
        reviewer_id: assignModal.id,
        team_id: selectedTeam,
      })
      const teamName = teams.find((t) => t.id === selectedTeam)?.team_name
      toast.success(`Assigned to ${teamName}`)
      setReviewers((prev) =>
        prev.map((r) =>
          r.id === assignModal.id
            ? { ...r, assigned_teams: [...r.assigned_teams, { id: selectedTeam, team_name: teamName! }] }
            : r
        )
      )
      setAssignModal(null)
      setSelectedTeam('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Assignment failed')
    } finally {
      setActionLoading(null)
    }
  }

  const removeAssignment = async (reviewerId: string, teamId: string) => {
    try {
      await api.delete(`/admin/reviewer-assignments/${reviewerId}/${teamId}`)
      toast.success('Assignment removed')
      setReviewers((prev) =>
        prev.map((r) =>
          r.id === reviewerId
            ? { ...r, assigned_teams: r.assigned_teams.filter((t) => t.id !== teamId) }
            : r
        )
      )
    } catch {
      toast.error('Failed to remove assignment')
    }
  }

  const filtered = reviewers.filter((r) => {
    const matchStatus = filter === 'all' || r.status === filter
    const matchSearch = !search ||
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const unassignedTeams = teams.filter(
    (t) => !assignModal?.assigned_teams.some((at) => at.id === t.id)
  )

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display text-gray-900">Reviewer Management</h1>
        <p className="text-gray-500 text-sm mt-1">Approve reviewer accounts and assign them to teams.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-9"
            placeholder="Search reviewers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'approved'] as const).map((f) => (
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
                <th className="table-header px-5 py-3 text-left">Reviewer</th>
                <th className="table-header px-5 py-3 text-left">Dept / Designation</th>
                <th className="table-header px-5 py-3 text-left">Expertise</th>
                <th className="table-header px-5 py-3 text-left">Assigned Teams</th>
                <th className="table-header px-5 py-3 text-left">Joined</th>
                <th className="table-header px-5 py-3 text-left">Status</th>
                <th className="table-header px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">
                    No reviewers found
                  </td>
                </tr>
              ) : (
                filtered.map((reviewer) => (
                  <tr key={reviewer.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Star className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{reviewer.full_name}</p>
                          <p className="text-xs text-gray-400">{reviewer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-gray-700 text-xs">{reviewer.department || '—'}</p>
                      <p className="text-gray-400 text-xs">{reviewer.designation || ''}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {reviewer.expertise?.slice(0, 2).map((e) => (
                          <span key={e} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-md">
                            {e}
                          </span>
                        ))}
                        {(reviewer.expertise?.length ?? 0) > 2 && (
                          <span className="text-[10px] text-gray-400">
                            +{(reviewer.expertise?.length ?? 0) - 2} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {reviewer.assigned_teams.length === 0 ? (
                          <span className="text-xs text-gray-400">None</span>
                        ) : (
                          reviewer.assigned_teams.map((t) => (
                            <span key={t.id} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                              {t.team_name}
                              <button
                                onClick={() => removeAssignment(reviewer.id, t.id)}
                                className="text-gray-400 hover:text-red-500 ml-0.5"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {format(new Date(reviewer.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-5 py-4">
                      <Badge status={reviewer.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {reviewer.status === 'pending' && (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={actionLoading === reviewer.id}
                            onClick={() => approveReviewer(reviewer.id)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </Button>
                        )}
                        {reviewer.status === 'approved' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setAssignModal(reviewer); setSelectedTeam('') }}
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Assign
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Modal */}
      <Modal
        open={!!assignModal}
        onClose={() => { setAssignModal(null); setSelectedTeam('') }}
        title={`Assign ${assignModal?.full_name} to a Team`}
      >
        <div className="space-y-4">
          {unassignedTeams.length === 0 ? (
            <Alert type="info">
              <span>This reviewer is already assigned to all approved teams.</span>
            </Alert>
          ) : (
            <>
              <Select
                label="Select Team"
                placeholder="-- Choose a team --"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                options={unassignedTeams.map((t) => ({ value: t.id, label: t.team_name }))}
              />
              {assignModal?.assigned_teams.length! > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Currently assigned to:</p>
                  <div className="flex flex-wrap gap-1">
                    {assignModal?.assigned_teams.map((t) => (
                      <span key={t.id} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {t.team_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setAssignModal(null)}>Cancel</Button>
                <Button
                  disabled={!selectedTeam}
                  loading={actionLoading === 'assign'}
                  onClick={assignToTeam}
                >
                  Assign Reviewer
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default ReviewerManagementPage
