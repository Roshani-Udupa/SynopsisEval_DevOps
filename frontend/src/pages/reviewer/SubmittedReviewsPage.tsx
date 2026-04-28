import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Star, Edit2, TrendingUp, MessageSquare, Calendar,
  CheckCircle2, Search, BarChart2,
} from 'lucide-react'
import { Spinner } from '../../components/ui'
import api from '../../utils/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'

interface ReviewEntry {
  team_id: string
  team_name: string
  relevance_score: number
  methodology_score: number
  presentation_score: number
  innovation_score: number
  total_score: number
  feedback_text: string | null
  submitted_at: string
  updated_at: string
}

const MiniBar: React.FC<{ label: string; score: number }> = ({ label, score }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-gray-400 w-20 flex-shrink-0">{label}</span>
    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full"
        style={{ width: `${(score / 10) * 100}%` }}
      />
    </div>
    <span className="text-[10px] font-medium text-gray-700 w-6 text-right">{score.toFixed(1)}</span>
  </div>
)

const SubmittedReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { fetchReviews() }, [])

  const fetchReviews = async () => {
    try {
      const res = await api.get('/reviewer/my-reviews')
      setReviews(res.data)
    } catch {
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = reviews.filter((r) =>
    !search || r.team_name.toLowerCase().includes(search.toLowerCase())
  )

  const avgScore = reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.total_score, 0) / reviews.length
    : 0

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display text-gray-900">My Submitted Reviews</h1>
        <p className="text-gray-500 text-sm mt-1">All review scores you have submitted this cycle.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: CheckCircle2, label: 'Reviews Submitted', value: reviews.length, color: 'bg-green-100 text-green-700' },
          { icon: TrendingUp, label: 'Average Score Given', value: `${avgScore.toFixed(1)}/40`, color: 'bg-blue-100 text-blue-700' },
          { icon: Star, label: 'Highest Score', value: reviews.length ? `${Math.max(...reviews.map(r => r.total_score)).toFixed(1)}/40` : '—', color: 'bg-amber-100 text-amber-700' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-display text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          className="input-field pl-9"
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Review cards */}
      {filtered.length === 0 ? (
        <div className="card p-14 text-center">
          <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No reviews submitted yet.</p>
          <Link to="/reviewer/assigned-teams" className="btn-primary mt-4 inline-flex">
            Go to Assigned Teams
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => {
            const isExpanded = expanded === review.team_id
            return (
              <div key={review.team_id} className="card overflow-hidden">
                {/* Main row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : review.team_id)}
                >
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{review.team_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Submitted {format(new Date(review.submitted_at), 'MMM d, yyyy')}
                      </span>
                      {review.updated_at !== review.submitted_at && (
                        <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                          Edited
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-2">
                    <p className="text-2xl font-display text-blue-700">
                      {review.total_score.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-gray-400">/ 40</p>
                  </div>
                  <div className={clsx(
                    'w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center flex-shrink-0 transition-transform duration-200',
                    isExpanded && 'rotate-180'
                  )}>
                    <svg className="w-3 h-3 text-gray-400" viewBox="0 0 12 12" fill="none">
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/30 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Score breakdown */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
                          Score Breakdown
                        </p>
                        <div className="space-y-2.5">
                          <MiniBar label="Relevance" score={review.relevance_score} />
                          <MiniBar label="Methodology" score={review.methodology_score} />
                          <MiniBar label="Presentation" score={review.presentation_score} />
                          <MiniBar label="Innovation" score={review.innovation_score} />
                        </div>
                      </div>

                      {/* Feedback */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3" />
                          Feedback
                        </p>
                        {review.feedback_text ? (
                          <p className="text-sm text-gray-600 leading-relaxed bg-white border border-gray-200 rounded-xl p-3">
                            {review.feedback_text}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No feedback provided.</p>
                        )}
                      </div>
                    </div>

                    {/* Edit action */}
                    <div className="mt-4 flex justify-end">
                      <Link
                        to={`/reviewer/submit-review/${review.team_id}`}
                        className="btn-secondary text-sm"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit Review
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SubmittedReviewsPage