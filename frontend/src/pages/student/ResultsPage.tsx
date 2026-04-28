import React, { useEffect, useState } from 'react'
import { Lock, BarChart2, Download, Star, MessageSquare, TrendingUp } from 'lucide-react'
import { Alert, Spinner, Badge } from '../../components/ui'
import api from '../../utils/api'
import { clsx } from 'clsx'

interface ScoreData {
  scores_released: boolean
  team_name: string
  scores: {
    reviewer_name: string
    relevance_score: number
    methodology_score: number
    presentation_score: number
    innovation_score: number
    total_score: number
    feedback_text?: string
  }[]
  similarity_score?: number
  plagiarism_status?: string
  averages?: {
    relevance: number
    methodology: number
    presentation: number
    innovation: number
    total: number
  }
}

const ScoreBar: React.FC<{ label: string; score: number; maxScore?: number }> = ({
  label, score, maxScore = 10
}) => {
  const pct = (score / maxScore) * 100
  const color = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'

  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-bold text-gray-900">{score.toFixed(1)} / {maxScore}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const ResultsPage: React.FC = () => {
  const [data, setData] = useState<ScoreData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchResults()
  }, [])

  const fetchResults = async () => {
    try {
      const res = await api.get('/student/results')
      setData(res.data)
    } catch {
      setData({ scores_released: false, team_name: '', scores: [] })
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

  if (!data?.scores_released) {
    return (
      <div className="max-w-5xl space-y-5">
        <div>
          <h1 className="text-2xl font-display text-gray-900">Results & Feedback</h1>
          <p className="text-gray-500 text-sm mt-1">View your review scores and plagiarism report.</p>
        </div>
        <div className="card p-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-display text-gray-900 mb-2">Results Not Yet Released</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Your review scores haven't been published by the administrator yet.
            You'll be notified once they're available.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-display text-gray-900">Results & Feedback</h1>
        <p className="text-gray-500 text-sm mt-1">
          Review scores for <strong>{data.team_name}</strong>
        </p>
      </div>

      <Alert type="success">
        <BarChart2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>Your scores have been released by the administrator. Results are final.</span>
      </Alert>

      {/* Aggregate score */}
      {data.averages && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Aggregate Scores
            </h3>
            <span className="text-2xl font-display text-blue-600">
              {data.averages.total.toFixed(1)}
              <span className="text-sm text-gray-400 font-body"> / 40</span>
            </span>
          </div>
          <div className="card-body space-y-4">
            <ScoreBar label="Relevance" score={data.averages.relevance} />
            <ScoreBar label="Methodology" score={data.averages.methodology} />
            <ScoreBar label="Presentation" score={data.averages.presentation} />
            <ScoreBar label="Innovation" score={data.averages.innovation} />
          </div>
        </div>
      )}

      {/* Plagiarism report */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">Similarity Report</h3>
          {data.plagiarism_status && (
            <Badge status={data.plagiarism_status as any} />
          )}
        </div>
        <div className="card-body">
          {data.plagiarism_status === 'completed' && data.similarity_score != null ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-display text-gray-900">
                  {data.similarity_score}%
                  <span className="text-sm font-body text-gray-400 ml-2">similarity detected</span>
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {data.similarity_score < 20
                    ? '✅ Within acceptable limits'
                    : data.similarity_score < 40
                    ? '⚠️ Moderate similarity detected — review flagged sections'
                    : '❌ High similarity — please revise your submission'}
                </p>
              </div>
              <button className="btn-secondary">
                <Download className="w-4 h-4" />
                Download Report (Mock)
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Plagiarism check not yet completed for your document.</p>
          )}
        </div>
      </div>

      {/* Individual reviewer scores */}
      {data.scores.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Reviewer Scores
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {data.scores.map((s, i) => (
              <div key={i} className="card-body space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Reviewer {i + 1}</p>
                  <span className="text-lg font-display text-blue-600">
                    {s.total_score.toFixed(1)}<span className="text-sm text-gray-400"> / 40</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <ScoreBar label="Relevance" score={s.relevance_score} />
                  <ScoreBar label="Methodology" score={s.methodology_score} />
                  <ScoreBar label="Presentation" score={s.presentation_score} />
                  <ScoreBar label="Innovation" score={s.innovation_score} />
                </div>
                {s.feedback_text && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" /> Feedback
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">{s.feedback_text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ResultsPage
