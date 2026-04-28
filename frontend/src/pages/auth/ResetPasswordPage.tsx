import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { BookOpen, ArrowLeft, Lock, Check } from 'lucide-react'
import { Input, Button, Alert } from '../../components/ui'
import api from '../../utils/api'

interface ResetForm {
  new_password: string
  confirm_password: string
}

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>()

  const newPassword = watch('new_password')

  const onSubmit = async (data: ResetForm) => {
    if (!token) {
      toast.error('Reset token is missing or invalid')
      return
    }

    try {
      await api.post('/auth/password-reset/confirm', {
        token,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      })
      setSubmitted(true)
      toast.success('Password updated')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to reset password')
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-12">
        <Link to="/login" className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-gray-900">Synopsis Portal</span>
        </Link>

        <div className="w-full max-w-md">
          <div className="card text-center">
            <div className="card-body py-10">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-display text-gray-900 mb-3">Reset link missing</h2>
              <Alert type="warning" className="text-left mb-6">
                <span className="text-sm text-gray-600">
                  This reset page needs the token from your email link. Request a new reset email
                  if your link is incomplete or expired.
                </span>
              </Alert>
              <Button variant="secondary" className="w-full mb-3" size="lg" onClick={() => navigate('/forgot-password')}>
                Request a new link
              </Button>
              <Button variant="ghost" className="w-full justify-center" onClick={() => navigate('/login')}>
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-12">
      <Link to="/login" className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <span className="font-display text-gray-900">Synopsis Portal</span>
      </Link>

      <div className="w-full max-w-md animate-slide-up">
        {!submitted ? (
          <div className="card">
            <div className="card-header">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-display text-gray-900">Create a new password</h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose a strong password for your Synopsis Review Portal account.
              </p>
            </div>

            <div className="card-body">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Input
                  label="New password"
                  type="password"
                  placeholder="••••••••"
                  error={errors.new_password?.message}
                  {...register('new_password', {
                    required: 'New password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                    validate: (value) =>
                      /[0-9]/.test(value) || 'Password must contain at least one digit',
                  })}
                />

                <Input
                  label="Confirm password"
                  type="password"
                  placeholder="••••••••"
                  error={errors.confirm_password?.message}
                  {...register('confirm_password', {
                    required: 'Please confirm your password',
                    validate: (value) => value === newPassword || 'Passwords do not match',
                  })}
                />

                <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
                  <Check className="w-4 h-4" />
                  Update Password
                </Button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="card text-center">
            <div className="card-body py-10">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-display text-gray-900 mb-3">Password updated</h2>
              <p className="text-gray-500 text-sm mb-5 leading-relaxed">
                Your password was reset successfully. You can now sign in with the new password.
              </p>
              <Button className="w-full justify-center" size="lg" onClick={() => navigate('/login')}>
                Go to Sign In
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordPage
