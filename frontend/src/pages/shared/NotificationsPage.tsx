import React, { useEffect, useState } from 'react'
import {
  Bell, CheckCheck, Trash2, Info, CheckCircle2,
  AlertTriangle, XCircle, ExternalLink, BellOff,
} from 'lucide-react'
import { Button, Spinner } from '../../components/ui'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  action_url: string | null
  created_at: string
}

const TYPE_CONFIG = {
  info:    { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-100',  icon_color: 'text-blue-500',   dot: 'bg-blue-500'   },
  success: { icon: CheckCircle2,  bg: 'bg-green-50',  border: 'border-green-100', icon_color: 'text-green-500',  dot: 'bg-green-500'  },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50',  border: 'border-amber-100', icon_color: 'text-amber-500',  dot: 'bg-amber-500'  },
  error:   { icon: XCircle,       bg: 'bg-red-50',    border: 'border-red-100',   icon_color: 'text-red-500',    dot: 'bg-red-500'    },
}

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => { fetchNotifications() }, [])

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data)
    } catch {
      // Show empty state
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => n.id === id ? { ...n, is_read: true } : n)
      )
    } catch { /* silent */ }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Failed to update notifications')
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {
      toast.error('Failed to delete notification')
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display text-gray-900 flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'
            }
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4" />
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
              filter === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            )}
          >
            {f === 'all' ? 'All' : 'Unread'}
            <span className={clsx(
              'ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
              filter === f ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
            )}>
              {f === 'all' ? notifications.length : unreadCount}
            </span>
          </button>
        ))}
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BellOff className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="font-display text-gray-900 mb-1">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-gray-400 text-sm">
            {filter === 'unread'
              ? 'You\'re all caught up!'
              : 'Notifications about your team, reviews, and portal activity will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => {
            const cfg = TYPE_CONFIG[note.type] || TYPE_CONFIG.info
            const Icon = cfg.icon
            return (
              <div
                key={note.id}
                className={clsx(
                  'card border transition-all duration-200',
                  !note.is_read
                    ? `${cfg.bg} ${cfg.border} shadow-sm`
                    : 'bg-white border-gray-200 opacity-75 hover:opacity-100'
                )}
                onClick={() => !note.is_read && markRead(note.id)}
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Icon */}
                  <div className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                    note.is_read ? 'bg-gray-100' : cfg.bg
                  )}>
                    <Icon className={clsx('w-4 h-4', note.is_read ? 'text-gray-400' : cfg.icon_color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={clsx(
                        'text-sm font-semibold',
                        note.is_read ? 'text-gray-600' : 'text-gray-900'
                      )}>
                        {!note.is_read && (
                          <span className={clsx('inline-block w-2 h-2 rounded-full mr-2 mb-0.5', cfg.dot)} />
                        )}
                        {note.title}
                      </p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={clsx(
                      'text-xs mt-1 leading-relaxed',
                      note.is_read ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      {note.message}
                    </p>
                    {note.action_url && (
                      <a
                        href={note.action_url}
                        className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View details <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!note.is_read && (
                      <button
                        title="Mark as read"
                        onClick={(e) => { e.stopPropagation(); markRead(note.id) }}
                        className="p-1.5 rounded-lg hover:bg-white/70 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); deleteNotification(note.id) }}
                      className="p-1.5 rounded-lg hover:bg-white/70 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Show all toggle when filtering unread */}
      {filter === 'unread' && notifications.length > unreadCount && (
        <div className="text-center">
          <button
            onClick={() => setFilter('all')}
            className="text-sm text-blue-600 hover:underline"
          >
            Show all {notifications.length} notifications →
          </button>
        </div>
      )}
    </div>
  )
}

export default NotificationsPage