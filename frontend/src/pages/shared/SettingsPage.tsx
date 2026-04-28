import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  User, Lock, Shield, Bell, ChevronRight,
  Eye, EyeOff, CheckCircle2, Save, Tag,
} from 'lucide-react'
import { Input, Button, Alert } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import { clsx } from 'clsx'

interface ProfileData {
  full_name: string
  email: string
  role: string
  status: string
  created_at: string
  department?: string
  designation?: string
  expertise?: string[]
  usn?: string
}

const EXPERTISE_OPTIONS = [
  'Machine Learning', 'Deep Learning', 'Computer Vision', 'NLP',
  'Web Development', 'Mobile Dev', 'Cloud Computing', 'Cybersecurity',
  'IoT', 'Blockchain', 'Data Science', 'Embedded Systems',
  'Networking', 'Database Systems', 'Software Engineering',
]

type Section = 'profile' | 'password' | 'notifications'

const SectionTab: React.FC<{
  icon: React.ElementType
  label: string
  active: boolean
  onClick: () => void
}> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={clsx(
      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 text-left',
      active
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    )}
  >
    <Icon className="w-4 h-4 flex-shrink-0" />
    {label}
    <ChevronRight className={clsx('w-4 h-4 ml-auto transition-transform', active && 'rotate-90')} />
  </button>
)

const SettingsPage: React.FC = () => {
  const { user, setUser } = useAuthStore()
  const [section, setSection] = useState<Section>('profile')
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [expertise, setExpertise] = useState<string[]>([])
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const profileForm = useForm<{ full_name: string; department: string; designation: string }>()
  const passwordForm = useForm<{ current_password: string; new_password: string; confirm_password: string }>()

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    try {
      const res = await api.get('/profile')
      setProfileData(res.data)
      setExpertise(res.data.expertise || [])
      profileForm.reset({
        full_name: res.data.full_name,
        department: res.data.department || '',
        designation: res.data.designation || '',
      })
    } catch { /* silent */ }
  }

  const saveProfile = async (data: any) => {
    setSavingProfile(true)
    try {
      await api.patch('/profile', {
        full_name: data.full_name,
        department: data.department || null,
        designation: data.designation || null,
        expertise: expertise.length > 0 ? expertise : null,
      })
      // Update auth store name
      if (user) setUser({ ...user, full_name: data.full_name })
      toast.success('Profile updated successfully')
      fetchProfile()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Update failed')
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async (data: any) => {
    setSavingPassword(true)
    try {
      await api.post('/profile/change-password', data)
      toast.success('Password changed successfully')
      passwordForm.reset()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  const toggleExpertise = (tag: string) => {
    setExpertise((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const roleLabel: Record<string, string> = {
    student_leader: 'Student Leader',
    student_member: 'Student Member',
    reviewer: 'Reviewer',
    admin: 'Administrator',
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-display text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your profile, security, and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar nav */}
        <div className="space-y-1">
          <SectionTab icon={User}   label="Profile"       active={section === 'profile'}       onClick={() => setSection('profile')} />
          <SectionTab icon={Lock}   label="Password"      active={section === 'password'}      onClick={() => setSection('password')} />
          <SectionTab icon={Bell}   label="Notifications" active={section === 'notifications'} onClick={() => setSection('notifications')} />
        </div>

        {/* Content area */}
        <div className="lg:col-span-3 animate-fade-in">

          {/* ── Profile ──────────────────────────────────────────────── */}
          {section === 'profile' && (
            <div className="space-y-4">
              {/* Identity card */}
              <div className="card">
                <div className="card-header flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow">
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{profileData?.full_name}</p>
                    <p className="text-sm text-gray-500">{profileData?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="badge bg-blue-100 text-blue-700">
                        {roleLabel[profileData?.role || ''] || profileData?.role}
                      </span>
                      <span className={clsx(
                        'badge',
                        profileData?.status === 'approved' ? 'badge-approved' : 'badge-pending'
                      )}>
                        {profileData?.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card-body">
                  <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
                    <Input
                      label="Full Name"
                      error={profileForm.formState.errors.full_name?.message}
                      {...profileForm.register('full_name', { required: 'Name is required' })}
                    />

                    <div>
                      <label className="label">Email Address</label>
                      <input
                        className="input-field opacity-60"
                        value={profileData?.email || ''}
                        disabled
                      />
                      <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact admin if needed.</p>
                    </div>

                    {profileData?.usn && (
                      <div>
                        <label className="label">University Seat Number (USN)</label>
                        <input className="input-field opacity-60 font-mono" value={profileData.usn} disabled />
                      </div>
                    )}

                    {(profileData?.role === 'reviewer' || profileData?.role === 'admin') && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <Input label="Department" placeholder="e.g., Computer Science" {...profileForm.register('department')} />
                          <Input label="Designation" placeholder="e.g., Associate Professor" {...profileForm.register('designation')} />
                        </div>
                      </>
                    )}

                    <Button type="submit" loading={savingProfile}>
                      <Save className="w-4 h-4" />
                      Save Profile
                    </Button>
                  </form>
                </div>
              </div>

              {/* Expertise tags (reviewer only) */}
              {profileData?.role === 'reviewer' && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      <Tag className="w-4 h-4 text-violet-500" />
                      Areas of Expertise
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Select all that apply</p>
                  </div>
                  <div className="card-body">
                    <div className="flex flex-wrap gap-2">
                      {EXPERTISE_OPTIONS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleExpertise(tag)}
                          className={clsx(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                            expertise.includes(tag)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                          )}
                        >
                          {expertise.includes(tag) && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                          {tag}
                        </button>
                      ))}
                    </div>
                    <Button
                      className="mt-4"
                      onClick={() => saveProfile(profileForm.getValues())}
                      loading={savingProfile}
                      variant="secondary"
                    >
                      <Save className="w-4 h-4" />
                      Save Expertise
                    </Button>
                  </div>
                </div>
              )}

              {/* Account info */}
              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-500" />
                    Account Information
                  </h3>
                </div>
                <div className="card-body space-y-3">
                  {[
                    { label: 'Account ID', value: user?.user_id?.slice(0, 8) + '...' },
                    { label: 'Role', value: roleLabel[profileData?.role || ''] || '—' },
                    { label: 'Status', value: profileData?.status },
                    {
                      label: 'Member Since',
                      value: profileData?.created_at
                        ? new Date(profileData.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
                        : '—'
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-500">{item.label}</span>
                      <span className="text-sm font-medium text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Password ─────────────────────────────────────────────── */}
          {section === 'password' && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-600" />
                  Change Password
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Use a strong password of at least 8 characters.
                </p>
              </div>
              <div className="card-body">
                <Alert type="info" className="mb-5">
                  <span className="text-xs">For security, you'll need to enter your current password before setting a new one.</span>
                </Alert>

                <form onSubmit={passwordForm.handleSubmit(changePassword)} className="space-y-4">
                  {/* Current password */}
                  <div className="relative">
                    <Input
                      label="Current Password"
                      type={showCurrent ? 'text' : 'password'}
                      placeholder="Your current password"
                      error={passwordForm.formState.errors.current_password?.message}
                      {...passwordForm.register('current_password', { required: 'Required' })}
                    />
                    <button type="button" onClick={() => setShowCurrent((p) => !p)}
                      className="absolute right-3 top-9 text-gray-400 hover:text-gray-600">
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-4">
                    {/* New password */}
                    <div className="relative">
                      <Input
                        label="New Password"
                        type={showNew ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        error={passwordForm.formState.errors.new_password?.message}
                        {...passwordForm.register('new_password', {
                          required: 'Required',
                          minLength: { value: 8, message: 'At least 8 characters' },
                        })}
                      />
                      <button type="button" onClick={() => setShowNew((p) => !p)}
                        className="absolute right-3 top-9 text-gray-400 hover:text-gray-600">
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Confirm new */}
                    <div className="relative">
                      <Input
                        label="Confirm New Password"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter new password"
                        error={passwordForm.formState.errors.confirm_password?.message}
                        {...passwordForm.register('confirm_password', {
                          required: 'Required',
                          validate: (v) =>
                            v === passwordForm.watch('new_password') || 'Passwords do not match',
                        })}
                      />
                      <button type="button" onClick={() => setShowConfirm((p) => !p)}
                        className="absolute right-3 top-9 text-gray-400 hover:text-gray-600">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" loading={savingPassword}>
                    <Lock className="w-4 h-4" />
                    Change Password
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* ── Notifications prefs ──────────────────────────────────── */}
          {section === 'notifications' && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  Notification Preferences
                </h3>
              </div>
              <div className="card-body space-y-4">
                {[
                  { label: 'Team status updates', desc: 'When your team is approved or rejected', enabled: true },
                  { label: 'Score releases', desc: 'When review scores are published', enabled: true },
                  { label: 'Document upload confirmations', desc: 'When a new version is uploaded', enabled: true },
                  { label: 'Review assignment notifications', desc: 'When you are assigned to a new team', enabled: true },
                  { label: 'System announcements', desc: 'Portal-wide announcements from admin', enabled: false },
                ].map((pref) => (
                  <div key={pref.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                      <p className="text-xs text-gray-400">{pref.desc}</p>
                    </div>
                    <button
                      className={clsx(
                        'relative inline-flex h-5 w-9 rounded-full transition-colors',
                        pref.enabled ? 'bg-blue-600' : 'bg-gray-200'
                      )}
                    >
                      <span className={clsx(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform m-0.5',
                        pref.enabled ? 'translate-x-4' : 'translate-x-0'
                      )} />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-gray-400 pt-2">
                  Note: In-app notifications are always enabled. Email delivery depends on SMTP configuration.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage