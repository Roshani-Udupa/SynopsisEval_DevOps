import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Send, Mail, Clock, CheckCircle2, ChevronDown } from 'lucide-react'
import { Button, Spinner, Alert } from '../../components/ui'
import api from '../../utils/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'

const TEMPLATES = [
  { id: 'custom', label: 'Custom Message', subject: '', body: '' },
  {
    id: 'approval',
    label: 'Team Approved Notification',
    subject: 'Your Team Registration Has Been Approved',
    body: `Dear Team,

We are pleased to inform you that your team registration has been approved on the Synopsis Review Portal.

You may now log in and begin submitting your project synopsis documents.

Please upload your documents before the deadline.

Best regards,
The Review Committee`,
  },
  {
    id: 'deadline',
    label: 'Submission Deadline Reminder',
    subject: 'Reminder: Synopsis Submission Deadline Approaching',
    body: `Dear Team,

This is a friendly reminder that the deadline for synopsis submission is approaching.

Please ensure your final document is uploaded before the due date to avoid disqualification.

If you have any issues, contact the administrator immediately.

Best regards,
The Review Committee`,
  },
  {
    id: 'scores',
    label: 'Scores Released Announcement',
    subject: 'Your Review Scores Are Now Available',
    body: `Dear Team,

We are pleased to announce that your review scores have been released and are now visible on your student portal.

Please log in to view your detailed scores and reviewer feedback.

Best regards,
The Review Committee`,
  },
]

const RECIPIENT_TYPES = [
  { value: 'all_teams', label: 'All Teams' },
  { value: 'all_reviewers', label: 'All Reviewers' },
  { value: 'pending_teams', label: 'Pending Teams Only' },
  { value: 'approved_teams', label: 'Approved Teams Only' },
]

interface EmailLog {
  id: string
  recipient_type: string
  subject: string
  status: string
  mock_sent_at: string
  created_at: string
}

const CommunicationsPage: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState('custom')
  const [recipientType, setRecipientType] = useState('all_teams')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  useEffect(() => { fetchLogs() }, [])

  const fetchLogs = async () => {
    try {
      const res = await api.get('/admin/email-logs')
      setLogs(res.data)
    } catch {
      // empty
    } finally {
      setLogsLoading(false)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const tpl = TEMPLATES.find((t) => t.id === templateId)
    if (tpl) {
      setSubject(tpl.subject)
      setBody(tpl.body)
    }
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and message body are required')
      return
    }
    setSending(true)
    try {
      const res = await api.post('/admin/communications/send', {
        recipient_type: recipientType,
        subject,
        body,
        template_used: selectedTemplate !== 'custom' ? selectedTemplate : null,
      })
      toast.success('Message logged and queued for sending!')
      setLogs((prev) => [res.data, ...prev])
      // Reset
      setSubject('')
      setBody('')
      setSelectedTemplate('custom')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display text-gray-900">Communications</h1>
        <p className="text-gray-500 text-sm mt-1">
          Send announcements to teams and reviewers. Messages are logged; SMTP delivery is simulated.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Compose */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              Compose Message
            </h3>
          </div>
          <div className="card-body space-y-4">
            {/* Template selector */}
            <div>
              <label className="label">Message Template</label>
              <div className="relative">
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="input-field appearance-none pr-9"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Recipients */}
            <div>
              <label className="label">Recipients</label>
              <div className="relative">
                <select
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value)}
                  className="input-field appearance-none pr-9"
                >
                  {RECIPIENT_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="label">Subject *</label>
              <input
                className="input-field"
                placeholder="Email subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Body */}
            <div>
              <label className="label">Message Body *</label>
              <textarea
                className="input-field resize-none h-40 font-mono text-xs leading-relaxed"
                placeholder="Type your message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <Alert type="info">
              <span className="text-xs">
                <strong>Mock Mode:</strong> Clicking Send will save this message to the database
                and simulate delivery. No actual emails will be sent.
              </span>
            </Alert>

            <Button
              onClick={handleSend}
              loading={sending}
              disabled={!subject || !body}
              className="w-full"
              size="lg"
            >
              <Send className="w-4 h-4" />
              Send Message
            </Button>
          </div>
        </div>

        {/* Logs */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              Message Log
            </h3>
            <span className="text-xs text-gray-400">{logs.length} sent</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
            {logsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="sm" />
              </div>
            ) : logs.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Mail className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No messages sent yet</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{log.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                          {RECIPIENT_TYPES.find((r) => r.value === log.recipient_type)?.label || log.recipient_type}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(log.created_at), 'MMM d • h:mm a')}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {log.status === 'sent' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommunicationsPage
