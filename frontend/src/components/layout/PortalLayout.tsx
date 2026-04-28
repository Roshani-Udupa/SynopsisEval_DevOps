import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  BookOpen, LogOut, Menu, X, ChevronRight,
  Bell, Settings, User
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  badge?: number
}

interface PortalLayoutProps {
  navItems: readonly NavItem[]
  children: React.ReactNode
  portalTitle: string
  portalColor?: string
}

const PortalLayout: React.FC<PortalLayoutProps> = ({
  navItems,
  children,
  portalTitle,
  portalColor = 'blue',
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    toast.success('Signed out successfully')
    navigate('/login')
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const Sidebar = ({ mobile = false }) => (
    <aside
      className={clsx(
        'flex flex-col h-full bg-white border-r border-gray-200',
        mobile ? 'w-full' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-display text-gray-900 text-sm leading-none">Synopsis Portal</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{portalTitle}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={clsx(
              'nav-item',
              isActive(item.path) && 'nav-item-active'
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className={clsx(
                'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                isActive(item.path) ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
              )}>
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 mb-1">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-[10px] text-gray-400 capitalize">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="nav-item w-full text-red-500 hover:bg-red-50 hover:text-red-600 mt-1"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-72 animate-slide-in-right ml-auto">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <span className="hidden lg:block">{portalTitle}</span>
              <ChevronRight className="hidden lg:block w-4 h-4 text-gray-300" />
              <span className="font-medium text-gray-900">
                {navItems.find((n) => isActive(n.path))?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              aria-label="Notifications"
              title="Notifications"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
            >
              <Bell className="w-4 h-4 text-gray-500" />
            </Link>
            <Link
              to="/settings"
              aria-label="Settings"
              title="Settings"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default PortalLayout
