import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, CheckCircle2, Clock, Star, ArrowRight,
  BookOpen, TrendingUp, Award, AlertCircle,
} from 'lucide-react'
import { Spinner } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'

interface DashboardData {
  total_assigned: number
  reviewed_count: number
  pending_count: number
  department?: string
  designation?: string
  expertise: string[]
  recent_reviews: {
    team_name: string
    total_score: number
    submitted_at: string
  }[]
}

const StatCard: React.FC<{
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  color: string
  to?: string
}> = ({ icon: Icon, label, value, sub, color, to }) => {
  const inner = (
    <div className={clsx(
      'card p-5 flex items-start gap-4 transition-all duration-200',
      to && 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
    )}>
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-3xl font-display text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {to && <ArrowRight className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

const ReviewerDashboard: React.FC = () => {
  const { user } = useAuthStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/reviewer/dashboard')
      setData(res.data)
    } catch {
      setData({ total_assigned: 0, reviewed_count: 0, pending_count: 0, expertise: [], recent_reviews: [] })
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>

  const completionPct = data!.total_assigned > 0
    ? Math.round((data!.reviewed_count / data!.total_assigned) * 100)
    : 0

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Welcome */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display text-gray-900">
            Welcome, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {data?.designation || 'Reviewer'}{data?.department ? ` · ${data.department}` : ''}
          </p>
        </div>
        {data!.pending_count > 0 && (
          <Link
            to="/reviewer/assigned-teams"
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            <strong>{data!.pending_count}</strong> team{data!.pending_count > 1 ? 's' : ''} awaiting your review
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Teams Assigned"
          value={data!.total_assigned}
          sub="Total this cycle"
          color="bg-blue-100 text-blue-700"
          to="/reviewer/assigned-teams"
        />
        <StatCard
          icon={CheckCircle2}
          label="Reviews Submitted"
          value={data!.reviewed_count}
          sub="Completed"
          color="bg-green-100 text-green-700"
          to="/reviewer/my-reviews"
        />
        <StatCard
          icon={Clock}
          label="Pending Reviews"
          value={data!.pending_count}
          sub="Still to review"
          color={data!.pending_count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}
          to="/reviewer/assigned-teams"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Progress ring card */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 text-sm mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Review Progress
          </h3>
          <div className="flex items-center gap-6">
            {/* SVG ring */}
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#2563eb" strokeWidth="3"
                  strokeDasharray={`${completionPct} ${100 - completionPct}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.8s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-display text-gray-900">{completionPct}%</span>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Reviewed</span>
                  <span className="font-semibold text-gray-900">{data!.reviewed_count} / {data!.total_assigned}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-700"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>
              {data!.pending_count > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {data!.pending_count} pending review{data!.pending_count > 1 ? 's' : ''}
                </p>
              )}
              {data!.pending_count === 0 && data!.total_assigned > 0 && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  All reviews submitted!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Expertise tags */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-violet-600" />
            Your Expertise
          </h3>
          {data!.expertise.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data!.expertise.map((tag) => (
                <span key={tag} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No expertise tags added yet.</p>
          )}
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 mt-4 text-xs text-blue-600 hover:underline"
          >
            Edit in Profile Settings <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900 text-sm">Quick Actions</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { to: '/reviewer/assigned-teams', icon: Users, label: 'View Assigned Teams', desc: 'See all teams you are assigned to review' },
            { to: '/reviewer/my-reviews', icon: BookOpen, label: 'My Submitted Reviews', desc: 'View and edit your past review scores' },
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

      {/* Recent reviews */}
      {data!.recent_reviews.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Recent Submissions
            </h3>
            <Link to="/reviewer/my-reviews" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data!.recent_reviews.map((r, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{r.team_name}</p>
                  <p className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-base font-display text-blue-700">{r.total_score.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">/40</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ReviewerDashboard