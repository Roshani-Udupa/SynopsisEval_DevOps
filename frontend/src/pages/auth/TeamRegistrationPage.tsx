import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  BookOpen, Check, ChevronRight, ChevronLeft,
  Plus, Trash2, Users, UserCircle, GraduationCap, ArrowRight
} from 'lucide-react'
import { Input, Button, Alert } from '../../components/ui'
import api from '../../utils/api'
import { clsx } from 'clsx'

interface MemberForm {
  full_name: string
  email: string
  usn: string
  password: string
}

interface TeamForm {
  team_name: string
  leader_name: string
  leader_email: string
  leader_usn: string
  leader_password: string
  members: MemberForm[]
  guide_name: string
  guide_email: string
  guide_department: string
}

const STEPS = [
  { id: 1, title: 'Team Info', icon: Users, desc: 'Team name & leader details' },
  { id: 2, title: 'Members', icon: UserCircle, desc: 'Add team members' },
  { id: 3, title: 'Guide', icon: GraduationCap, desc: 'Assign project guide' },
  { id: 4, title: 'Review', icon: Check, desc: 'Confirm & submit' },
]

const TeamRegistrationPage: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<TeamForm>({
    defaultValues: {
      members: [{ full_name: '', email: '', usn: '', password: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'members' })
  const watched = watch()

  const validateStep = async () => {
    const fieldsByStep: Record<number, (keyof TeamForm)[]> = {
      1: ['team_name', 'leader_name', 'leader_email', 'leader_usn', 'leader_password'],
      2: ['members'],
      3: ['guide_name', 'guide_email'],
    }
    return trigger(fieldsByStep[step] as any)
  }

  const nextStep = async () => {
    const valid = await validateStep()
    if (valid) setStep((s) => Math.min(s + 1, 4))
  }

  const onSubmit = async (data: TeamForm) => {
    try {
      await api.post('/auth/register/team', {
        team_name: data.team_name,
        leader_name: data.leader_name,
        leader_email: data.leader_email,
        leader_usn: data.leader_usn,
        leader_password: data.leader_password,
        members: data.members,
        guide: {
          full_name: data.guide_name,
          email: data.guide_email,
          department: data.guide_department || null,
        },
      })
      setSubmitted(true)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-display text-gray-900 mb-3">Registration Submitted!</h2>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed">
            Your team <strong className="text-gray-900">{watched.team_name}</strong> has been submitted for review.
            All team members will receive access once an administrator approves your registration.
          </p>
          <Alert type="info" className="mb-6 text-left">
            <span>Check your email for confirmation details. The approval process may take 1–2 business days.</span>
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
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-gray-900">Synopsis Portal</span>
          </Link>
          <span className="text-sm text-gray-500">Team Registration</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-3xl">
          {/* Step indicator */}
          <div className="flex items-center mb-10">
            {STEPS.map((s, idx) => (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2',
                      step > s.id
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : step === s.id
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                        : 'bg-white border-gray-200 text-gray-400'
                    )}
                  >
                    {step > s.id ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <s.icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={clsx('text-xs font-medium', step >= s.id ? 'text-blue-700' : 'text-gray-400')}>
                      {s.title}
                    </p>
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={clsx('step-connector mx-2 mb-5', step > s.id && 'active')} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Card */}
          <div className="card animate-fade-in">
            <div className="card-header">
              <h2 className="text-xl font-display text-gray-900">
                {STEPS[step - 1].title}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{STEPS[step - 1].desc}</p>
            </div>
            <div className="card-body">
              <form onSubmit={(event) => event.preventDefault()}>

                {/* ── Step 1: Team & Leader ─────────────────── */}
                {step === 1 && (
                  <div className="space-y-5">
                    <Input
                      label="Team Name *"
                      placeholder="e.g., Neural Nexus"
                      error={errors.team_name?.message}
                      {...register('team_name', { required: 'Team name is required' })}
                    />
                    <div className="border-t border-gray-100 pt-5">
                      <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <span className="w-5 h-5 bg-blue-100 rounded text-blue-600 flex items-center justify-center text-xs font-bold">L</span>
                        Team Leader Details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="Full Name *"
                          placeholder="Leader's full name"
                          error={errors.leader_name?.message}
                          {...register('leader_name', { required: 'Required' })}
                        />
                        <Input
                          label="Email *"
                          type="email"
                          placeholder="leader@example.com"
                          error={errors.leader_email?.message}
                          {...register('leader_email', {
                            required: 'Required',
                            pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                          })}
                        />
                        <Input
                          label="USN *"
                          placeholder="e.g., 1MS23CS001"
                          error={errors.leader_usn?.message}
                          {...register('leader_usn', { required: 'Required' })}
                        />
                        <Input
                          label="Password *"
                          type="password"
                          placeholder="Min. 8 characters"
                          error={errors.leader_password?.message}
                          {...register('leader_password', {
                            required: 'Required',
                            minLength: { value: 8, message: 'Min. 8 characters' },
                          })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Step 2: Members ───────────────────────── */}
                {step === 2 && (
                  <div className="space-y-4">
                    <Alert type="info">
                      <span>Add all team members (excluding the leader). Each member will receive their own login.</span>
                    </Alert>

                    {fields.map((field, idx) => (
                      <div key={field.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700">Member {idx + 1}</span>
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(idx)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input
                            label="Full Name *"
                            placeholder="Member's name"
                            error={errors.members?.[idx]?.full_name?.message}
                            {...register(`members.${idx}.full_name`, { required: 'Required' })}
                          />
                          <Input
                            label="Email *"
                            type="email"
                            placeholder="member@example.com"
                            error={errors.members?.[idx]?.email?.message}
                            {...register(`members.${idx}.email`, {
                              required: 'Required',
                              pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid' },
                            })}
                          />
                          <Input
                            label="USN *"
                            placeholder="e.g., 1MS23CS002"
                            error={errors.members?.[idx]?.usn?.message}
                            {...register(`members.${idx}.usn`, { required: 'Required' })}
                          />
                          <Input
                            label="Password *"
                            type="password"
                            placeholder="Min. 8 characters"
                            error={errors.members?.[idx]?.password?.message}
                            {...register(`members.${idx}.password`, {
                              required: 'Required',
                              minLength: { value: 8, message: 'Min. 8 chars' },
                            })}
                          />
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => append({ full_name: '', email: '', usn: '', password: '' })}
                      className="w-full border-dashed"
                    >
                      <Plus className="w-4 h-4" /> Add Another Member
                    </Button>
                  </div>
                )}

                {/* ── Step 3: Guide ─────────────────────────── */}
                {step === 3 && (
                  <div className="space-y-5">
                    <Alert type="info">
                      <span>Provide your faculty guide's details. They will be listed on your submission.</span>
                    </Alert>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Guide's Full Name *"
                        placeholder="Prof. John Doe"
                        error={errors.guide_name?.message}
                        {...register('guide_name', { required: 'Guide name is required' })}
                      />
                      <Input
                        label="Guide's Email *"
                        type="email"
                        placeholder="guide@university.edu"
                        error={errors.guide_email?.message}
                        {...register('guide_email', {
                          required: 'Required',
                          pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                        })}
                      />
                      <Input
                        label="Department"
                        placeholder="e.g., Computer Science"
                        className="sm:col-span-2"
                        {...register('guide_department')}
                      />
                    </div>
                  </div>
                )}

                {/* ── Step 4: Review ────────────────────────── */}
                {step === 4 && (
                  <div className="space-y-5">
                    <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-900">Team: {watched.team_name}</span>
                      </div>
                      <div className="pl-6 text-sm text-gray-600 space-y-1">
                        <p><span className="font-medium">Leader:</span> {watched.leader_name} ({watched.leader_usn})</p>
                        {watched.members?.map((m, i) => (
                          <p key={i}><span className="font-medium">Member {i + 1}:</span> {m.full_name} ({m.usn})</p>
                        ))}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-900">Guide: {watched.guide_name}</span>
                      </div>
                      <p className="pl-6 text-sm text-gray-500">{watched.guide_email}</p>
                      {watched.guide_department && (
                        <p className="pl-6 text-sm text-gray-500">{watched.guide_department}</p>
                      )}
                    </div>
                    <Alert type="warning">
                      <span>Please verify all details before submitting. Contact admin to make changes after submission.</span>
                    </Alert>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep((s) => Math.max(s - 1, 1))}
                    disabled={step === 1}
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>

                  {step < 4 ? (
                    <Button type="button" onClick={nextStep}>
                      Next <ChevronRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
                      Submit Registration <Check className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-6">
            Already registered?{' '}
            <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default TeamRegistrationPage
