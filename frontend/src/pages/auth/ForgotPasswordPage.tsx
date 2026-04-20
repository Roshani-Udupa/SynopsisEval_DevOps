import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { BookOpen, Mail, ArrowLeft, Check, Send } from 'lucide-react'
import { Input, Button, Alert } from '../../components/ui'
import api from '../../utils/api'

interface ForgotForm {
  email: string
}

const ForgotPasswordPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>()

  const onSubmit = async (data: ForgotForm) => {
    try {
      await api.post('/auth/password-reset/request', { email: data.email })
      setSubmittedEmail(data.email)
      setSubmitted(true)
    } catch (err: any) {
      // Still show success to prevent email enumeration
      setSubmittedEmail(data.email)
      setSubmitted(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
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
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-display text-gray-900">Forgot your password?</h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter your registered email and we'll send you a reset link.
              </p>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email address' },
                  })}
                />

                <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
                  <Send className="w-4 h-4" />
                  Send Reset Link
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
          /* Success State */
          <div className="card text-center">
            <div className="card-body py-10">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-display text-gray-900 mb-3">Check your inbox</h2>
              <p className="text-gray-500 text-sm mb-5 leading-relaxed">
                If an account exists for{' '}
                <strong className="text-gray-900">{submittedEmail}</strong>, you'll receive a
                password reset link shortly.
              </p>

              <Alert type="info" className="text-left mb-6">
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Didn't receive it?</p>
                  <ul className="text-gray-600 space-y-0.5 list-disc list-inside text-xs">
                    <li>Check your spam or junk folder</li>
                    <li>Make sure you used your registered email</li>
                    <li>The link expires in 1 hour</li>
                  </ul>
                </div>
              </Alert>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setSubmitted(false)}
                  className="btn-secondary w-full justify-center"
                >
                  Try a different email
                </button>
                <Link to="/login" className="btn-ghost w-full justify-center">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ForgotPasswordPage
