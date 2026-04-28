import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShieldOff, ArrowLeft, Home, BookOpen, AlertTriangle, ServerOff } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { clsx } from 'clsx'

type ErrorType = '403' | '404' | '500'

interface ErrorConfig {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  code: string
  title: string
  desc: string
}

const ERROR_CONFIGS: Record<ErrorType, ErrorConfig> = {
  '403': {
    icon: ShieldOff,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
    code: '403',
    title: 'Access Denied',
    desc: "You don't have permission to view this page. This area may require a different role or your account may not be approved yet.",
  },
  '404': {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-500',
    code: '404',
    title: 'Page Not Found',
    desc: "The page you're looking for doesn't exist or may have been moved. Check the URL or navigate back to a safe page.",
  },
  '500': {
    icon: ServerOff,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    code: '500',
    title: 'Something Went Wrong',
    desc: "We encountered an unexpected error. Please try refreshing the page. If the problem persists, contact your administrator.",
  },
}

interface ErrorPageProps {
  type?: ErrorType
}

const ErrorPage: React.FC<ErrorPageProps> = ({ type }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()

  // Detect error type from route if not passed as prop
  const resolvedType: ErrorType =
    type ||
    (location.pathname.includes('403') ? '403' :
     location.pathname.includes('500') ? '500' : '404')

  const cfg = ERROR_CONFIGS[resolvedType]
  const Icon = cfg.icon

  const homeRoute =
    user?.role === 'admin' ? '/admin' :
    user?.role?.startsWith('student') ? '/student' :
    user?.role === 'reviewer' ? '/reviewer' :
    '/login'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Minimal header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <Link to={homeRoute} className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-gray-900">Synopsis Portal</span>
        </Link>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center animate-slide-up">
          {/* Error code decoration */}
          <div className="relative mb-8">
            <p className="text-[120px] font-display text-gray-100 leading-none select-none">
              {cfg.code}
            </p>
            <div className={clsx(
              'absolute inset-0 flex items-center justify-center'
            )}>
              <div className={clsx('w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm', cfg.iconBg)}>
                <Icon className={clsx('w-10 h-10', cfg.iconColor)} />
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-display text-gray-900 mb-3">{cfg.title}</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">{cfg.desc}</p>

          {/* Context-aware help for 403 */}
          {resolvedType === '403' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-medium text-blue-900 mb-2">Possible reasons:</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                {!user && <li>You are not logged in</li>}
                {user?.status === 'pending' && <li>Your account is awaiting admin approval</li>}
                {user && <li>This section requires a different role ({user.role.replace('_', ' ')} access only)</li>}
                <li>Your session may have expired</li>
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="btn-secondary w-full sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>

            <Link to={homeRoute} className="btn-primary w-full sm:w-auto">
              <Home className="w-4 h-4" />
              {user ? 'Go to Dashboard' : 'Back to Login'}
            </Link>

            {resolvedType === '500' && (
              <button
                onClick={() => window.location.reload()}
                className="btn-ghost w-full sm:w-auto text-sm"
              >
                ↺ Refresh Page
              </button>
            )}
          </div>

          {/* Quick links for logged-in users */}
          {user && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-400 mb-3">Or navigate to:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { to: homeRoute, label: 'Dashboard' },
                  { to: '/notifications', label: 'Notifications' },
                  { to: '/settings', label: 'Settings' },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-all"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ErrorPage