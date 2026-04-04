'use client'

import { useState, useTransition } from 'react'
import { updatePassword } from '@/actions/auth'
import { Eye, EyeOff, Lock } from 'lucide-react'

export default function ChangePasswordForm() {
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew,         setShowNew]         = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)
  const [message,         setMessage]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending,       startTransition]    = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    startTransition(async () => {
      const result = await updatePassword(newPassword)
      if (result?.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Password updated successfully.' })
        setNewPassword('')
        setConfirmPassword('')
      }
    })
  }

  return (
    <div
      className="p-6 mb-5"
      style={{
        background:   '#FDFAF7',
        borderRadius: '20px',
        border:       '1px solid rgba(10,46,77,0.07)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(10,46,77,0.06)' }}
        >
          <Lock width={15} height={15} strokeWidth={1.5} style={{ color: '#0A2E4D' }} />
        </div>
        <h2 className="text-[#0A2E4D] text-base font-bold f-display">Change Password</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          show={showNew}
          onToggle={() => setShowNew(v => !v)}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirm}
          onToggle={() => setShowConfirm(v => !v)}
          autoComplete="new-password"
        />

        {message != null && (
          <p
            className="text-sm f-body px-4 py-3 rounded-xl"
            style={{
              background: message.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.08)',
              color:      message.type === 'success' ? '#16A34A' : '#DC2626',
              border:     `1px solid ${message.type === 'success' ? 'rgba(74,222,128,0.25)' : 'rgba(239,68,68,0.15)'}`,
            }}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="self-start px-5 py-2.5 rounded-xl text-sm font-semibold f-body transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: '#0A2E4D', color: '#fff' }}
        >
          {isPending ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  show:         boolean
  onToggle:     () => void
  autoComplete: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.55)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm f-body outline-none transition-colors"
          style={{
            background:   'rgba(10,46,77,0.04)',
            border:       '1px solid rgba(10,46,77,0.1)',
            color:        '#0A2E4D',
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show
            ? <EyeOff width={14} height={14} strokeWidth={1.5} style={{ color: 'rgba(10,46,77,0.35)' }} />
            : <Eye    width={14} height={14} strokeWidth={1.5} style={{ color: 'rgba(10,46,77,0.35)' }} />
          }
        </button>
      </div>
    </div>
  )
}
