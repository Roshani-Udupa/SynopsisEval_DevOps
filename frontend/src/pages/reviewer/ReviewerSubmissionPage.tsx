import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ChevronLeft, FileText, Users, Download, CheckCircle2,
  Star, MessageSquare, Info, ShieldCheck, AlertTriangle, Loader2,
} from 'lucide-react'
import { Button, Spinner, Alert, Badge } from '../../components/ui'
import api from '../../utils/api'
import { downloadDocument } from '../../utils/download'
import { clsx } from 'clsx'
import { format } from 'date-fns'

interface TeamDetail {
  team_id: string
  team_name: string
  team_status: string
  members: { full_name: string; usn: string; role: string }[]
  guide: { full_name: string; department?: string } | null
  documents: {
    id: string
    file_name: string
    file_size_bytes: number
    version: number
    is_latest: boolean
    uploaded_at: string
    uploaded_by: string
    similarity_score: number | null
    plagiarism_status: string | null
  }[]
  existing_score: {
    relevance_score: number
    methodology_score: number
    presentation_score: number
    innovation_score: number
    feedback_text: string | null
    submitted_at: string
  } | null
}

const CRITERIA = [
  {
    key: 'relevance_score' as const,
    label: 'Relevance & Scope',
    desc: 'How well the project addresses a real problem and fits the domain',
    color: 'blue',
  },
  {
    key: 'methodology_score' as const,
    label: 'Methodology',
    desc: 'Quality of the research approach, technical design, and plan',
    color: 'violet',
  },
  {
    key: 'presentation_score' as const,
    label: 'Presentation & Clarity',
    desc: 'Writing quality, structure, grammar, and overall readability',
    color: 'indigo',
  },
  {
    key: 'innovation_score' as const,
    label: 'Innovation',
    desc: 'Originality, novelty of approach, and creative problem-solving',
    color: 'cyan',
  },
]

type Scores = Record<string, number>

const ScoreSlider: React.FC<{
  label: string
  desc: string
  value: number
  onChange: (v: number) => void
  color: string
}> = ({ label, desc, value, onChange, color }) => {
  const pct = (value / 10) * 100
  const colorMap: Record<string, string> = {
    blue: 'accent-blue-600',
    violet: 'accent-violet-600',
    indigo: 'accent-indigo-600',
    cyan: 'accent-cyan-600',
  }
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-600',
    violet: 'bg-violet-600',
    indigo: 'bg-indigo-600',
    cyan: 'bg-cyan-600',
  }
  const textMap: Record<string, string> = {
    blue: 'text-blue-700',
    violet: 'text-violet-700',
    indigo: 'text-indigo-700',
    cyan: 'text-cyan-700',
  }

  const getLabel = (v: number) => {
    if (v <= 2) return 'Poor'
    if (v <= 4) return 'Below Average'
    if (v <= 6) return 'Average'
    if (v <= 8) return 'Good'
    return 'Excellent'
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={clsx('text-2xl font-display', textMap[color])}>{value.toFixed(1)}</span>
          <span className="text-xs text-gray-400">/10</span>
          <p className={clsx('text-[10px] font-medium mt-0.5', textMap[color])}>{getLabel(value)}</p>
        </div>
      </div>
      <div className="relative">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all duration-100', bgMap[color])}
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={clsx('absolute inset-0 w-full opacity-0 cursor-pointer h-2', colorMap[color])}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-300">
        <span>0 — Poor</span>
        <span>5 — Average</span>
        <span>10 — Excellent</span>
      </div>
    </div>
  )
}

const ReviewSubmissionPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [scores, setScores] = useState<Scores>({
    relevance_score: 5,
    methodology_score: 5,
    presentation_score: 5,
    innovation_score: 5,
  })
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => { fetchTeam() }, [teamId])

  const fetchTeam = async () => {
    try {
      const res = await api.get(`/reviewer/teams/${teamId}`)
      setTeam(res.data)
      if (res.data.existing_score) {
        const s = res.data.existing_score
        setScores({
          relevance_score: s.relevance_score,
          methodology_score: s.methodology_score,
          presentation_score: s.presentation_score,
          innovation_score: s.innovation_score,
        })
        setFeedback(s.feedback_text || '')
      }
    } catch {
      toast.error('Failed to load team details')
      navigate('/reviewer/assigned-teams')
    } finally {
      setLoading(false)
    }
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0)

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      await downloadDocument(documentId, fileName)
    } catch {
      toast.error('Failed to download document')
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await api.post('/reviewer/scores', {
        team_id: teamId,
        ...scores,
        feedback_text: feedback || null,
      })
      toast.success(team?.existing_score ? 'Review updated!' : 'Review submitted!')
      setSubmitted(true)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  if (!team) return null

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 animate-slide-up">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-display text-gray-900 mb-3">
          {team.existing_score ? 'Review Updated!' : 'Review Submitted!'}
        </h2>
        <p className="text-gray-500 text-sm mb-2">
          Your review for <strong>{team.team_name}</strong> has been recorded.
        </p>
        <p className="text-blue-700 font-display text-3xl mb-6">{total.toFixed(1)} <span className="text-gray-400 font-body text-base">/ 40</span></p>
        <div className="flex justify-center gap-3">
          <Link to="/reviewer/assigned-teams" className="btn-secondary">← Back to Teams</Link>
          <Link to="/reviewer/my-reviews" className="btn-primary">View My Reviews</Link>
        </div>
      </div>
    )
  }

  const latestDoc = team.documents.find((d) => d.is_latest)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/reviewer/assigned-teams" className="btn-ghost p-2 mt-0.5">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-display text-gray-900">
            {team.existing_score ? 'Edit Review' : 'Submit Review'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Team: <strong className="text-gray-700">{team.team_name}</strong>
          </p>
        </div>
      </div>

      {team.existing_score && (
        <Alert type="info">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            You submitted a review for this team on{' '}
            <strong>{format(new Date(team.existing_score.submitted_at), 'MMM d, yyyy')}</strong>.
            Submitting again will overwrite your previous scores.
          </span>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Team info + document */}
        <div className="space-y-4">
          {/* Team members */}
          <div className="card">
            <div className="card-header py-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" /> Team Members
              </h3>
            </div>
            <div className="px-4 py-3 space-y-2">
              {team.members.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={clsx(
                    'w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                    m.role === 'student_leader' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  )}>
                    {m.role === 'student_leader' ? 'L' : 'M'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{m.full_name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{m.usn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Guide */}
          {team.guide && (
            <div className="card p-4">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Guide</p>
              <p className="text-sm font-medium text-gray-900">{team.guide.full_name}</p>
              {team.guide.department && <p className="text-xs text-gray-400">{team.guide.department}</p>}
            </div>
          )}

          {/* Document */}
          {latestDoc ? (
            <div className="card p-4 space-y-3">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Synopsis Document</p>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-900 truncate">{latestDoc.file_name}</p>
                  <p className="text-[10px] text-gray-400">v{latestDoc.version} · {latestDoc.uploaded_by}</p>
                </div>
              </div>
              {latestDoc.similarity_score !== null && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-xs">
                  {latestDoc.similarity_score < 20
                    ? <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  }
                  <span className="text-gray-600">
                    Similarity: <strong>{latestDoc.similarity_score.toFixed(1)}%</strong>
                  </span>
                </div>
              )}
              <button
                className="btn-secondary w-full text-xs justify-center py-2"
                onClick={() => handleDownload(latestDoc.id, latestDoc.file_name)}
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
            </div>
          ) : (
            <div className="card p-4 text-center">
              <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No document uploaded yet</p>
            </div>
          )}
        </div>

        {/* Right: Score form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Scoring Criteria
              </h3>
              <div className="text-right">
                <span className="text-2xl font-display text-blue-700">{total.toFixed(1)}</span>
                <span className="text-xs text-gray-400"> / 40</span>
              </div>
            </div>
            <div className="card-body space-y-7">
              {CRITERIA.map((c) => (
                <ScoreSlider
                  key={c.key}
                  label={c.label}
                  desc={c.desc}
                  value={scores[c.key]}
                  onChange={(v) => setScores((prev) => ({ ...prev, [c.key]: v }))}
                  color={c.color}
                />
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                Feedback for Team
                <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </h3>
            </div>
            <div className="card-body">
              <textarea
                className="input-field resize-none h-32"
                placeholder="Provide constructive feedback about the synopsis — strengths, areas for improvement, specific suggestions..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-2">
                Feedback will be visible to the team after scores are published by the administrator.
              </p>
            </div>
          </div>

          {/* Score summary + Submit */}
          <div className="card p-5">
            <div className="grid grid-cols-4 gap-3 mb-5">
              {CRITERIA.map((c) => (
                <div key={c.key} className="text-center">
                  <p className="text-lg font-display text-gray-900">{scores[c.key].toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{c.label.split(' ')[0]}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Total Score</p>
                <p className="text-3xl font-display text-blue-700">
                  {total.toFixed(1)}<span className="text-base text-gray-400 font-body"> / 40</span>
                </p>
              </div>
              <Button
                size="lg"
                loading={submitting}
                onClick={handleSubmit}
                disabled={!latestDoc}
              >
                <CheckCircle2 className="w-4 h-4" />
                {team.existing_score ? 'Update Review' : 'Submit Review'}
              </Button>
            </div>
            {!latestDoc && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Cannot submit — team has not uploaded a document yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewSubmissionPage