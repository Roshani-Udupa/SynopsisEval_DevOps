import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

// Auth pages
import LoginPage from './pages/auth/LoginPage'
import TeamRegistrationPage from './pages/auth/TeamRegistrationPage'
import ReviewerRegistrationPage from './pages/auth/ReviewerRegistrationPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import SettingsPage from './pages/shared/SettingsPage'
import NotificationsPage from './pages/shared/NotificationsPage'
import ErrorPage from './pages/shared/ErrorPage'

// Layout
import PortalLayout from './components/layout/PortalLayout'

// Student pages
import StudentDashboard from './pages/student/StudentDashboard'
import DocumentManagementPage from './pages/student/DocumentManagementPage'
import ResultsPage from './pages/student/ResultsPage'

// Reviewer pages
import ReviewerDashboard from './pages/reviewer/ReviewerDashboard'
import AssignedTeamsPage from './pages/reviewer/AssignedTeamsPage'
import SubmittedReviewsPage from './pages/reviewer/SubmittedReviewsPage'
import ReviewSubmissionPage from './pages/reviewer/ReviewerSubmissionPage'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import TeamManagementPage from './pages/admin/TeamManagementPage'
import ReviewerManagementPage from './pages/admin/ReviewerManagementPage'
import DocumentHubPage from './pages/admin/DocumentHubPage'
import ScoreDashboardPage from './pages/admin/ScoreDashboardPage'
import CommunicationsPage from './pages/admin/CommunicationsPage'

// Store
import { useAuthStore } from './store/authStore'

// Nav configs
import {
  LayoutDashboard, FileText, BarChart2,
  Users, Star, Zap, TrendingUp, Mail, Bell, Settings
} from 'lucide-react'

const STUDENT_NAV = [
  { label: 'Dashboard', path: '/student', icon: LayoutDashboard },
  { label: 'Documents', path: '/student/documents', icon: FileText },
  { label: 'Results & Feedback', path: '/student/results', icon: BarChart2 },
]

const ADMIN_NAV = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Team Management', path: '/admin/teams', icon: Users },
  { label: 'Reviewer Management', path: '/admin/reviewers', icon: Star },
  { label: 'Document Hub', path: '/admin/documents', icon: FileText },
  { label: 'Score Dashboard', path: '/admin/scores', icon: TrendingUp },
  { label: 'Communications', path: '/admin/communications', icon: Mail },
]

const REVIEWER_NAV = [
  { label: 'Dashboard', path: '/reviewer', icon: LayoutDashboard },
  { label: 'Assigned Teams', path: '/reviewer/assigned-teams', icon: Users },
  { label: 'My Reviews', path: '/reviewer/my-reviews', icon: FileText },
]

const COMMON_NAV = [
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'Settings', path: '/settings', icon: Settings },
]

const PORTAL_CONFIG = {
  student_leader: { navItems: [...STUDENT_NAV, ...COMMON_NAV], portalTitle: 'Student Portal' },
  student_member: { navItems: [...STUDENT_NAV, ...COMMON_NAV], portalTitle: 'Student Portal' },
  reviewer: { navItems: [...REVIEWER_NAV, ...COMMON_NAV], portalTitle: 'Reviewer Portal' },
  admin: { navItems: [...ADMIN_NAV, ...COMMON_NAV], portalTitle: 'Admin Portal' },
} as const

// ── Route Guards ───────────────────────────────────────────────────────────
const RequireAuth: React.FC<{
  children: React.ReactNode
  allowedRoles?: string[]
}> = ({ children, allowedRoles }) => {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/error/403" replace />
  }
  return <>{children}</>
}

const SharedPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user)

  if (!user) return <Navigate to="/login" replace />

  const config = PORTAL_CONFIG[user.role as keyof typeof PORTAL_CONFIG]
  if (!config) return <Navigate to="/error/403" replace />

  return (
    <PortalLayout navItems={config.navItems} portalTitle={config.portalTitle}>
      {children}
    </PortalLayout>
  )
}

const StudentPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RequireAuth allowedRoles={['student_leader', 'student_member']}>
    <PortalLayout navItems={STUDENT_NAV} portalTitle="Student Portal">
      {children}
    </PortalLayout>
  </RequireAuth>
)

const AdminPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RequireAuth allowedRoles={['admin']}>
    <PortalLayout navItems={ADMIN_NAV} portalTitle="Admin Portal">
      {children}
    </PortalLayout>
  </RequireAuth>
)

const ReviewerPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RequireAuth allowedRoles={['reviewer']}>
    <PortalLayout navItems={REVIEWER_NAV} portalTitle="Reviewer Portal">
      {children}
    </PortalLayout>
  </RequireAuth>
)

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: '14px',
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register/team" element={<TeamRegistrationPage />} />
        <Route path="/register/reviewer" element={<ReviewerRegistrationPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Student Portal */}
        <Route path="/student" element={
          <StudentPortal><StudentDashboard /></StudentPortal>
        } />
        <Route path="/student/documents" element={
          <StudentPortal><DocumentManagementPage /></StudentPortal>
        } />
        <Route path="/student/results" element={
          <StudentPortal><ResultsPage /></StudentPortal>
        } />

        {/* Admin Portal */}
        <Route path="/admin" element={
          <AdminPortal><AdminDashboard /></AdminPortal>
        } />
        <Route path="/admin/teams" element={
          <AdminPortal><TeamManagementPage /></AdminPortal>
        } />
        <Route path="/admin/reviewers" element={
          <AdminPortal><ReviewerManagementPage /></AdminPortal>
        } />
        <Route path="/admin/documents" element={
          <AdminPortal><DocumentHubPage /></AdminPortal>
        } />
        <Route path="/admin/scores" element={
          <AdminPortal><ScoreDashboardPage /></AdminPortal>
        } />
        <Route path="/admin/communications" element={
          <AdminPortal><CommunicationsPage /></AdminPortal>
        } />

        {/* Reviewer Portal */}
        <Route path="/reviewer" element={
          <ReviewerPortal><ReviewerDashboard /></ReviewerPortal>
        } />
        <Route path="/reviewer/assigned-teams" element={
          <ReviewerPortal><AssignedTeamsPage /></ReviewerPortal>
        } />
        <Route path="/reviewer/my-reviews" element={
          <ReviewerPortal><SubmittedReviewsPage /></ReviewerPortal>
        } />
        <Route path="/reviewer/submit-review/:teamId" element={
          <ReviewerPortal><ReviewSubmissionPage /></ReviewerPortal>
        } />

        {/* Shared Pages */}
        <Route path="/settings" element={
          <SharedPortal><SettingsPage /></SharedPortal>
        } />
        <Route path="/notifications" element={
          <SharedPortal><NotificationsPage /></SharedPortal>
        } />

        {/* Error Pages */}
        <Route path="/error/403" element={<ErrorPage type="403" />} />
        <Route path="/error/404" element={<ErrorPage type="404" />} />
        <Route path="/error/500" element={<ErrorPage type="500" />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/error/404" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
