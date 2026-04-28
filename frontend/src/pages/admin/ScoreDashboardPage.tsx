import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { BarChart2, Eye, EyeOff, TrendingUp, Users, Star } from 'lucide-react'
import { Button, Spinner } from '../../components/ui'
import api from '../../utils/api'
import { clsx } from 'clsx'

interface TeamScore {
  team_id: string
  team_name: string
  scores_released: boolean
  reviewer_scores: {
    reviewer_name: string
    total_score: number
  }[]
  average_score?: number
  document_count: number
  plagiarism_done: boolean
}

const ToggleSwitch: React.FC<{
  checked: boolean
  onChange: (val: boolean) => void
  loading?: boolean
  disabled?: boolean
}> = ({ checked, onChange, loading, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled || loading}
    onClick={() => onChange(!checked)}
    className={clsx(
      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none',
      checked ? 'bg-green-500' : 'bg-gray-200',
      (disabled || loading) && 'opacity-50 cursor-not-allowed'
    )}
  >
    <span
      className={clsx(
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-6' : 'translate-x-1'
      )}
    />
  </button>
)

const ScoreDashboardPage: React.FC = () => {
  const [teamScores, setTeamScores] = useState<TeamScore[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [publishingAll, setPublishingAll] = useState(false)

  useEffect(() => { fetchScores() }, [])

  const fetchScores = async () => {
    try {
      const res = await api.get('/admin/score-dashboard')
      setTeamScores(res.data)
    } catch {
      toast.error('Failed to load score data')
    } finally {
      setLoading(false)
    }
  }

  const toggleRelease = async (teamId: string, release: boolean) => {
    setTogglingId(teamId)
    try {
      await api.patch(`/admin/teams/${teamId}/release-scores`, { scores_released: release })
      setTeamScores((prev) =>
        prev.map((t) => t.team_id === teamId ? { ...t, scores_released: release } : t)
      )
      toast.success(release ? 'Scores published for team' : 'Scores hidden from team')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Action failed')
    } finally {
      setTogglingId(null)
    }
  }

  const publishAll = async () => {
    setPublishingAll(true)
    try {
      await api.post('/admin/score-dashboard/publish-all')
      setTeamScores((prev) => prev.map((t) => ({ ...t, scores_released: true })))
      toast.success('Scores published for all teams!')
    } catch {
      toast.error('Failed to publish all scores')
    } finally {
      setPublishingAll(false)
    }
  }

  const releasedCount = teamScores.filter((t) => t.scores_released).length
  const allReleased = teamScores.length > 0 && releasedCount === teamScores.length

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display text-gray-900">Score Release Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Control which teams can view their review scores.
          </p>
        </div>
        <Button
          onClick={publishAll}
          loading={publishingAll}
          disabled={allReleased}
          size="lg"
        >
          <Eye className="w-4 h-4" />
          {allReleased ? 'All Published' : 'Publish All Scores'}
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-4 flex-wrap">
        <div className="card px-5 py-3 flex items-center gap-3">
          <Users className="w-5 h-5 text-blue-600" />
          <span className="text-2xl font-display text-gray-900">{teamScores.length}</span>
          <span className="text-xs text-gray-500">Total Teams</span>
        </div>
        <div className="card px-5 py-3 flex items-center gap-3">
          <Eye className="w-5 h-5 text-green-600" />
          <span className="text-2xl font-display text-gray-900">{releasedCount}</span>
          <span className="text-xs text-gray-500">Scores Published</span>
        </div>
        <div className="card px-5 py-3 flex items-center gap-3">
          <EyeOff className="w-5 h-5 text-gray-400" />
          <span className="text-2xl font-display text-gray-900">{teamScores.length - releasedCount}</span>
          <span className="text-xs text-gray-500">Not Yet Published</span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="table-header px-5 py-3 text-left">Team</th>
                <th className="table-header px-5 py-3 text-left">Docs</th>
                <th className="table-header px-5 py-3 text-left">Plagiarism</th>
                <th className="table-header px-5 py-3 text-left">Reviewer Scores</th>
                <th className="table-header px-5 py-3 text-left">Avg Score</th>
                <th className="table-header px-5 py-3 text-left">Published</th>
                <th className="table-header px-5 py-3 text-left">Toggle</th>
              </tr>
            </thead>
            <tbody>
              {teamScores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">
                    No approved teams found
                  </td>
                </tr>
              ) : (
                teamScores.map((team) => (
                  <tr key={team.team_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="font-semibold text-gray-900">{team.team_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500">{team.document_count}</td>
                    <td className="px-5 py-4">
                      {team.plagiarism_done ? (
                        <span className="text-green-600 text-xs font-medium flex items-center gap-1">
                          ✓ Done
                        </span>
                      ) : (
                        <span className="text-amber-500 text-xs">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {team.reviewer_scores.length === 0 ? (
                        <span className="text-gray-400 text-xs">No scores yet</span>
                      ) : (
                        <div className="space-y-0.5">
                          {team.reviewer_scores.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <Star className="w-3 h-3 text-amber-400" />
                              <span className="text-gray-600">{s.reviewer_name}:</span>
                              <span className="font-semibold text-gray-900">{s.total_score.toFixed(1)}/40</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {team.average_score != null ? (
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-display text-blue-700 text-base">
                            {team.average_score.toFixed(1)}
                          </span>
                          <span className="text-gray-400 text-xs">/40</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {team.scores_released ? (
                        <span className="badge-approved">Yes</span>
                      ) : (
                        <span className="badge-pending">No</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <ToggleSwitch
                        checked={team.scores_released}
                        onChange={(val) => toggleRelease(team.team_id, val)}
                        loading={togglingId === team.team_id}
                      />
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

export default ScoreDashboardPage
