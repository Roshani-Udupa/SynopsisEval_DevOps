import React from 'react'
import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

// ── Input ──────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <input
        ref={ref}
        className={clsx('input-field', error && 'input-error', className)}
        {...props}
      />
      {error && <p className="error-text">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
)
Input.displayName = 'Input'

// ── Select ─────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <select
        ref={ref}
        className={clsx('input-field', error && 'input-error', className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="error-text">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'

// ── Textarea ───────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <textarea
        ref={ref}
        className={clsx(
          'input-field resize-none min-h-[100px]',
          error && 'input-error',
          className
        )}
        {...props}
      />
      {error && <p className="error-text">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'

// ── Button ─────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading,
  size = 'md',
  children,
  className,
  disabled,
  ...props
}) => {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  }[variant]

  const sizeClass = {
    sm: 'px-3 py-1.5 text-xs',
    md: '',
    lg: 'px-7 py-3 text-base',
  }[size]

  return (
    <button
      className={clsx(variantClass, sizeClass, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

// ── Badge ──────────────────────────────────────────────────────────────────
interface BadgeProps {
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed'
  label?: string
}

export const Badge: React.FC<BadgeProps> = ({ status, label }) => {
  const classMap: Record<string, string> = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    processing: 'badge-processing',
    completed: 'badge-completed',
    failed: 'badge bg-red-100 text-red-700',
  }

  return (
    <span className={classMap[status] || 'badge bg-gray-100 text-gray-700'}>
      {label || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────
export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className,
}) => {
  const sizeClass = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size]
  return <Loader2 className={clsx('animate-spin text-blue-600', sizeClass, className)} />
}

// ── Card ───────────────────────────────────────────────────────────────────
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={clsx('card', className)}>{children}</div>

// ── Alert ──────────────────────────────────────────────────────────────────
interface AlertProps {
  type: 'info' | 'success' | 'warning' | 'error'
  children: React.ReactNode
  className?: string
}

export const Alert: React.FC<AlertProps> = ({ type, children, className }) => {
  const typeClass = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  }[type]

  return (
    <div className={clsx('flex gap-3 p-4 rounded-xl border text-sm', typeClass, className)}>
      {children}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={clsx('relative bg-white rounded-2xl shadow-xl w-full animate-slide-up', sizeClass)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
