import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { BookOpen, Eye, EyeOff, Star, Check, ArrowRight, X, Plus } from 'lucide-react'
import { Input, Button, Alert } from '../../components/ui'
import api from '../../utils/api'
import { clsx } from 'clsx'

interface ReviewerForm {
  full_name: string
  email: string
  password: string
  confirm_password: string
  department: string
  designation: string
}

const EXPERTISE_OPTIONS = [
  'Machine Learning', 'Deep Learning', 'Computer Vision', 'NLP',
  'Web Development', 'Mobile Dev', 'Cloud Computing', 'Cybersecurity',
  'IoT', 'Blockchain', 'Data Science', 'Embedded Systems',
  'Networking', 'Database Systems', 'Software Engineering',
]

const ReviewerRegistrationPage: React.FC = () => {
  const navigate = useNavigate()
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [expertise, setExpertise] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReviewerForm>()

  const password = watch('password')

  const toggleExpertise = (tag: string) => {
    setExpertise((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const onSubmit = async (data: ReviewerForm) => {
    try {
      await api.post('/auth/register/reviewer', {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        department: data.department || null,
        designation: data.designation || null,
        expertise,
      })
      setSubmitted(true)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed. Please try again.')
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-display text-gray-900 mb-3">Application Submitted!</h2>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed">
            Your reviewer application has been received. An administrator will review your profile
            and approve your account shortly.
          </p>
          <Alert type="info" className="mb-6 text-left">
            <span>You'll be notified via email once your account is approved. This typically takes 1–2 business days.</span>
          </Alert>
          <Link to="/login" className="btn-primary inline-flex">
            Back to Login <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-gray-900">Synopsis Portal</span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Star className="w-4 h-4 text-blue-500" />
            Reviewer Registration
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-2xl animate-slide-up">
          <div className="mb-7">
            <h2 className="text-3xl font-display text-gray-900 mb-2">Join as a Reviewer</h2>
            <p className="text-gray-500 text-sm">
              Create your reviewer account to evaluate student project synopses.
              Your account will be activated after admin approval.
            </p>
          </div>

          <div className="card">
            <div className="card-body">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Personal Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Full Name *"
                      placeholder="Dr. Jane Smith"
                      error={errors.full_name?.message}
                      className="sm:col-span-2"
                      {...register('full_name', { required: 'Full name is required' })}
                    />
                    <Input
                      label="Email Address *"
                      type="email"
                      placeholder="you@university.edu"
                      error={errors.email?.message}
                      {...register('email', {
                        required: 'Email is required',
                        pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                      })}
                    />
                    <Input
                      label="Department"
                      placeholder="e.g., Computer Science"
                      {...register('department')}
                    />
                    <Input
                      label="Designation"
                      placeholder="e.g., Associate Professor"
                      className="sm:col-span-2"
                      {...register('designation')}
                    />
                  </div>
                </div>

                {/* Expertise */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1 pb-2 border-b border-gray-100">
                    Areas of Expertise
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">Select all that apply (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {EXPERTISE_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleExpertise(tag)}
                        className={clsx(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                          expertise.includes(tag)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                        )}
                      >
                        {expertise.includes(tag) && <Check className="w-3 h-3 inline mr-1" />}
                        {tag}
                      </button>
                    ))}
                  </div>
                  {expertise.length > 0 && (
                    <p className="text-xs text-blue-600 mt-2">
                      {expertise.length} area{expertise.length > 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
                    Set Password
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <Input
                        label="Password *"
                        type={showPwd ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        error={errors.password?.message}
                        {...register('password', {
                          required: 'Password is required',
                          minLength: { value: 8, message: 'Minimum 8 characters' },
                        })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((p) => !p)}
                        className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                      >
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        label="Confirm Password *"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        error={errors.confirm_password?.message}
                        {...register('confirm_password', {
                          required: 'Please confirm password',
                          validate: (val) => val === password || 'Passwords do not match',
                        })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((p) => !p)}
                        className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Alert type="info">
                  <span>
                    Your account will be in <strong>pending</strong> state until approved by an administrator.
                    You'll receive an email notification upon approval.
                  </span>
                </Alert>

                <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
                  Submit Application <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ReviewerRegistrationPage
