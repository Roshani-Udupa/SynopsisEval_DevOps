import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, Clock, AlertCircle, FileText,
  BarChart2, Users, ArrowRight, Info
} from 'lucide-react'
import { Badge, Alert, Spinner } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'

interface TeamData {
  id: string
  team_name: string
  status: 'pending' | 'approved' | 'rejected'
  scores_released: boolean
  rejection_note?: string
  created_at: string
  members: { full_name: string; usn: string; role: string }[]
  guide?: { full_name: string; department?: string }
  latest_document?: { file_name: string; created_at: string; version: number }
}

const StatCard: React.FC<{
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
}> = ({ icon: Icon, label, value, sub, color }) => (
  <div className="card p-5 flex items-start gap-4">
    <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-display text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
)

const StudentDashboard: React.FC = () => {
  const { user } = useAuthStore()
  const isLeader = user?.role === 'student_leader'
  const [team, setTeam] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTeam()
  }, [])

  const fetchTeam = async () => {
    try {
      const res = await api.get('/student/team')
      setTeam(res.data)
    } catch {
      // team not found / pending
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-display text-gray-900">
          Welcome back, {user?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isLeader ? 'You are the Team Leader' : 'Student Member'} — here's your team overview.
        </p>
      </div>

      {/* Alerts */}
      {team?.status === 'pending' && (
        <Alert type="warning">
          <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Registration Under Review</p>
            <p className="text-xs mt-0.5 opacity-80">
              Your team registration is awaiting administrator approval. Some features are disabled until then.
            </p>
          </div>
        </Alert>
      )}

      {team?.status === 'rejected' && (
        <Alert type="error">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Team Registration Rejected</p>
            {team.rejection_note && (
              <p className="text-xs mt-0.5 opacity-80">Reason: {team.rejection_note}</p>
            )}
          </div>
        </Alert>
      )}

      {team?.status === 'approved' && team.scores_released && (
        <Alert type="success">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Scores Released!</p>
            <p className="text-xs mt-0.5 opacity-80">
              Your review scores are now available.{' '}
              <Link to="/student/results" className="underline font-medium">View Results →</Link>
            </p>
          </div>
        </Alert>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Team Status"
          value={team?.status ? team.status.charAt(0).toUpperCase() + team.status.slice(1) : '—'}
          sub={team ? `"${team.team_name}"` : 'Not registered'}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          icon={Users}
          label="Team Members"
          value={team?.members?.length ?? 0}
          sub="including leader"
          color="bg-indigo-100 text-indigo-700"
        />
        <StatCard
          icon={FileText}
          label="Documents"
          value={team?.latest_document ? `v${team.latest_document.version}` : 'None'}
          sub={team?.latest_document ? `Last: ${formatDistanceToNow(new Date(team.latest_document.created_at), { addSuffix: true })}` : 'No uploads yet'}
          color="bg-violet-100 text-violet-700"
        />
        <StatCard
          icon={BarChart2}
          label="Scores"
          value={team?.scores_released ? 'Released' : 'Pending'}
          sub={team?.scores_released ? 'Click to view' : 'Not yet released'}
          color={team?.scores_released ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
        />
      </div>

      {/* Team Info card */}
      {team && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Members */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Team Members</h3>
              <Badge status={team.status} />
            </div>
            <div className="card-body p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header px-5 py-3 text-left">Name</th>
                    <th className="table-header px-5 py-3 text-left">USN</th>
                    <th className="table-header px-5 py-3 text-left">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {team.members.map((m, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-900">{m.full_name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{m.usn}</td>
                      <td className="px-5 py-3">
                        <span className={clsx(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          m.role === 'student_leader'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        )}>
                          {m.role === 'student_leader' ? 'Leader' : 'Member'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Links + Guide */}
          <div className="space-y-4">
            {/* Guide */}
            {team.guide && (
              <div className="card p-5">
                <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">Project Guide</p>
                <p className="font-semibold text-gray-900">{team.guide.full_name}</p>
                {team.guide.department && (
                  <p className="text-sm text-gray-500">{team.guide.department}</p>
                )}
              </div>
            )}

            {/* Quick nav */}
            <div className="card divide-y divide-gray-100">
              {[
                {
                  to: '/student/documents',
                  icon: FileText,
                  label: 'Document Management',
                  desc: isLeader ? 'Upload & manage versions' : 'View uploaded files',
                  disabled: team.status !== 'approved',
                },
                {
                  to: '/student/results',
                  icon: BarChart2,
                  label: 'Results & Feedback',
                  desc: 'View scores when released',
                  disabled: !team.scores_released,
                },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.disabled ? '#' : item.to}
                  className={clsx(
                    'flex items-center gap-4 px-5 py-4 group transition-colors',
                    item.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-blue-50/50'
                  )}
                  onClick={(e) => item.disabled && e.preventDefault()}
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <item.icon className="w-4 h-4 text-gray-600 group-hover:text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {!team && !loading && (
        <div className="card p-10 text-center">
          <Info className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No team registration found.</p>
          <p className="text-gray-400 text-xs mt-1">Please contact your administrator.</p>
        </div>
      )}
    </div>
  )
}

export default StudentDashboard
