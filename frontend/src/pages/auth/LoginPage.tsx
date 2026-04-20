import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Eye, EyeOff, BookOpen, ArrowRight, ShieldCheck, Users, Star } from 'lucide-react'
import { Input, Button, Alert } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'

interface LoginForm {
  email: string
  password: string
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const [showPassword, setShowPassword] = useState(false)
  const [pendingMsg, setPendingMsg] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setPendingMsg('')
    try {
      const res = await api.post('/auth/login', data)
      const user = res.data

      setUser(user)
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`)

      // Route based on role & status
      if (user.status === 'pending') {
        setPendingMsg('Your account is awaiting administrator approval.')
        useAuthStore.getState().logout()
        return
      }

      const roleRoutes: Record<string, string> = {
        admin: '/admin',
        student_leader: '/student',
        student_member: '/student',
        reviewer: '/reviewer',
      }
      navigate(roleRoutes[user.role] || '/')
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Login failed. Please try again.'
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 relative overflow-hidden flex-col justify-between p-12">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/30 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-950/40 rounded-full translate-y-1/2 -translate-x-1/3 blur-2xl" />
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 opacity-5">
          <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="300" cy="300" r="298" stroke="white" strokeWidth="2" strokeDasharray="8 8"/>
            <circle cx="300" cy="300" r="200" stroke="white" strokeWidth="2" strokeDasharray="8 8"/>
            <circle cx="300" cy="300" r="100" stroke="white" strokeWidth="2" strokeDasharray="8 8"/>
          </svg>
        </div>

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-white/90 font-display text-xl">Synopsis Portal</span>
          </div>
        </div>

        {/* Main content */}
        <div className="relative space-y-8">
          <div>
            <h1 className="text-5xl font-display text-white leading-tight mb-4">
              Streamlined<br />
              Academic<br />
              <em>Review.</em>
            </h1>
            <p className="text-blue-200 text-lg leading-relaxed max-w-sm">
              Submit, review, and evaluate student project synopses — all in one unified platform.
            </p>
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-1 gap-3">
            {[
              { icon: Users, label: 'Team-based submissions with role management' },
              { icon: ShieldCheck, label: 'AI-powered plagiarism detection' },
              { icon: Star, label: 'Structured reviewer scoring & feedback' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3"
              >
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-blue-200" />
                </div>
                <span className="text-blue-100 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-blue-300/60 text-sm">
          © 2024 Synopsis Review Portal. Academic Use Only.
        </p>
      </div>

      {/* ── Right Panel ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gray-50">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-gray-900 font-display">Synopsis Portal</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-display text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-500 text-sm">Sign in to continue to your portal</p>
          </div>

          {pendingMsg && (
            <Alert type="warning" className="mb-6">
              <span>{pendingMsg}</span>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
              })}
            />

            <div>
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  error={errors.password?.message}
                  {...register('password', { required: 'Password is required' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <Link
                  to="/forgot-password"
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full"
              size="lg"
            >
              Sign In
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-gray-50 text-gray-400">New to the portal?</span>
            </div>
          </div>

          {/* Registration links */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/register/team"
              className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200 group"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Users className="w-4 h-4 text-blue-700" />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center leading-tight">Register Team</span>
              <span className="text-[10px] text-gray-400 text-center">For students</span>
            </Link>
            <Link
              to="/register/reviewer"
              className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200 group"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Star className="w-4 h-4 text-blue-700" />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center leading-tight">Join as Reviewer</span>
              <span className="text-[10px] text-gray-400 text-center">For faculty</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
