import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Clock, FileText, Star, CheckCircle2,
  XCircle, ArrowRight, TrendingUp, Activity
} from 'lucide-react'
import { Spinner } from '../../components/ui'
import api from '../../utils/api'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'

interface DashboardStats {
  total_teams: number
  pending_teams: number
  approved_teams: number
  rejected_teams: number
  total_reviewers: number
  pending_reviewers: number
  total_documents: number
  plagiarism_completed: number
  scores_released_count: number
  recent_activity: {
    type: string
    label: string
    time: string
  }[]
}

const KPICard: React.FC<{
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  color: string
  to?: string
  highlight?: boolean
}> = ({ icon: Icon, label, value, sub, color, to, highlight }) => {
  const inner = (
    <div className={clsx(
      'card p-5 flex items-start gap-4 transition-all duration-200',
      to && 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
      highlight && 'ring-2 ring-amber-400 ring-offset-1'
    )}>
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-3xl font-display text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {to && <ArrowRight className="w-4 h-4 text-gray-300 mt-1" />}
    </div>
  )

  return to ? <Link to={to}>{inner}</Link> : inner
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/dashboard/stats')
      setStats(res.data)
    } catch {
      // mock fallback
      setStats({
        total_teams: 0, pending_teams: 0, approved_teams: 0, rejected_teams: 0,
        total_reviewers: 0, pending_reviewers: 0, total_documents: 0,
        plagiarism_completed: 0, scores_released_count: 0, recent_activity: [],
      })
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

  const s = stats!

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-display text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of all portal activity and pending actions.</p>
      </div>

      {/* Pending alerts */}
      {(s.pending_teams > 0 || s.pending_reviewers > 0) && (
        <div className="flex flex-wrap gap-3">
          {s.pending_teams > 0 && (
            <Link to="/admin/teams" className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 hover:bg-amber-100 transition-colors">
              <Clock className="w-4 h-4" />
              <strong>{s.pending_teams}</strong> team{s.pending_teams > 1 ? 's' : ''} awaiting approval
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
          {s.pending_reviewers > 0 && (
            <Link to="/admin/reviewers" className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 hover:bg-blue-100 transition-colors">
              <Clock className="w-4 h-4" />
              <strong>{s.pending_reviewers}</strong> reviewer{s.pending_reviewers > 1 ? 's' : ''} awaiting approval
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label="Total Teams"
          value={s.total_teams}
          sub={`${s.approved_teams} approved`}
          color="bg-blue-100 text-blue-700"
          to="/admin/teams"
        />
        <KPICard
          icon={Clock}
          label="Pending Approvals"
          value={s.pending_teams}
          sub="Teams awaiting review"
          color="bg-amber-100 text-amber-700"
          to="/admin/teams"
          highlight={s.pending_teams > 0}
        />
        <KPICard
          icon={Star}
          label="Reviewers"
          value={s.total_reviewers}
          sub={`${s.pending_reviewers} pending`}
          color="bg-violet-100 text-violet-700"
          to="/admin/reviewers"
        />
        <KPICard
          icon={FileText}
          label="Documents Uploaded"
          value={s.total_documents}
          sub={`${s.plagiarism_completed} checked`}
          color="bg-indigo-100 text-indigo-700"
          to="/admin/documents"
        />
        <KPICard
          icon={CheckCircle2}
          label="Approved Teams"
          value={s.approved_teams}
          color="bg-green-100 text-green-700"
        />
        <KPICard
          icon={XCircle}
          label="Rejected Teams"
          value={s.rejected_teams}
          color="bg-red-100 text-red-700"
        />
        <KPICard
          icon={Activity}
          label="Plagiarism Checks"
          value={s.plagiarism_completed}
          sub="Completed"
          color="bg-cyan-100 text-cyan-700"
        />
        <KPICard
          icon={TrendingUp}
          label="Scores Released"
          value={s.scores_released_count}
          sub={`of ${s.total_teams} teams`}
          color="bg-emerald-100 text-emerald-700"
          to="/admin/scores"
        />
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 text-sm">Quick Actions</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { to: '/admin/teams', icon: Users, label: 'Manage Teams', desc: 'Approve, reject & view team details' },
              { to: '/admin/reviewers', icon: Star, label: 'Manage Reviewers', desc: 'Approve accounts & assign to teams' },
              { to: '/admin/documents', icon: FileText, label: 'Document Hub', desc: 'View uploads & trigger plagiarism checks' },
              { to: '/admin/scores', icon: TrendingUp, label: 'Score Dashboard', desc: 'Publish scores for student visibility' },
              { to: '/admin/communications', icon: Activity, label: 'Communications', desc: 'Send announcements to teams' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-4 px-5 py-4 hover:bg-blue-50/50 transition-colors group"
              >
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <item.icon className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
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

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 text-sm">Recent Activity</h3>
          </div>
          <div className="card-body">
            {s.recent_activity?.length > 0 ? (
              <div className="space-y-3">
                {s.recent_activity.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-700">{a.label}</p>
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(a.time), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Activity className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No recent activity yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
