'use client'

/**
 * ResetPasswordForm — new password + confirm password.
 *
 * Uses the browser Supabase client directly because the password reset token
 * is embedded in the URL hash by Supabase's redirect mechanism and must be
 * exchanged on the client side.
 *
 * On success redirects to /dashboard.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updatePassword } from '@/actions/auth'
import { Check } from 'lucide-react'

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(10,46,77,0.04)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'rgba(10,46,77,0.12)',
  borderRadius: '12px',
  padding: '13px 16px',
  color: '#0A2E4D',
  fontSize: '15px',
  fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
  outline: 'none',
  transition: 'border-color 0.15s ease',
}

const inputFocusStyle: React.CSSProperties = {
  borderColor: 'rgba(230,126,80,0.55)',
}

const inputErrorStyle: React.CSSProperties = {
  background: 'rgba(220,50,50,0.08)',
  borderColor: 'rgba(220,50,50,0.2)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(10,46,77,0.4)',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  marginBottom: '8px',
  fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
}

const errorTextStyle: React.CSSProperties = {
  color: 'rgba(220,50,50,0.9)',
  fontSize: '12px',
  marginTop: '6px',
  fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
}

// ─── Field error map type ──────────────────────────────────────────────────────

type FieldErrors = {
  password?: string
  confirmPassword?: string
  form?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ResetPasswordForm() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  function validate(): boolean {
    const next: FieldErrors = {}

    if (!password) {
      next.password = 'Password is required.'
    } else if (password.length < 8) {
      next.password = 'Password must be at least 8 characters.'
    }

    if (!confirmPassword) {
      next.confirmPassword = 'Please confirm your password.'
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setErrors({})

    try {
      const { error } = await updatePassword(password)

      if (error) {
        setErrors({ form: error })
        setIsLoading(false)
        return
      }

      setIsSuccess(true)

      // Give the user a moment to read the success message before redirecting
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (err) {
      console.error('[reset-password] Unexpected error:', err)
      setErrors({ form: 'An unexpected error occurred. Please try again.' })
      setIsLoading(false)
    }
  }

  // ─── Success state ──────────────────────────────────────────────────────────

  if (isSuccess) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(230,126,80,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}
        >
          <Check size={28} strokeWidth={2.5} aria-hidden="true" style={{ color: '#E67E50' }} />
        </div>
        <h2
          style={{
            color: '#0A2E4D',
            fontSize: '22px',
            fontWeight: 700,
            marginBottom: '12px',
            lineHeight: 1.2,
          }}
          className="f-display"
        >
          Password updated
        </h2>
        <p
          style={{
            color: 'rgba(10,46,77,0.55)',
            fontSize: '15px',
            lineHeight: 1.6,
          }}
          className="f-body"
        >
          Redirecting you to your dashboard...
        </p>
      </div>
    )
  }

  // ─── Form state ─────────────────────────────────────────────────────────────

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} noValidate>

      {/* Form-level error */}
      {errors.form && (
        <div
          role="alert"
          style={{
            background: 'rgba(220,50,50,0.08)',
            border: '1px solid rgba(220,50,50,0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
          }}
        >
          <p style={{ color: 'rgba(220,50,50,0.9)', fontSize: '14px', margin: 0 }} className="f-body">
            {errors.form}
          </p>
        </div>
      )}

      {/* New password */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="reset-password" style={labelStyle} className="f-body">
          New password
        </label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value) }}
          onFocus={() => { setFocusedField('password') }}
          onBlur={() => { setFocusedField(null) }}
          style={{
            ...inputStyle,
            ...(focusedField === 'password' ? inputFocusStyle : {}),
            ...(errors.password ? inputErrorStyle : {}),
          }}
          aria-describedby={errors.password ? 'reset-password-error' : undefined}
          aria-invalid={!!errors.password}
          placeholder="Min. 8 characters"
          disabled={isLoading}
        />
        {errors.password && (
          <p id="reset-password-error" role="alert" style={errorTextStyle} className="f-body">
            {errors.password}
          </p>
        )}
      </div>

      {/* Confirm new password */}
      <div style={{ marginBottom: '28px' }}>
        <label htmlFor="reset-confirm-password" style={labelStyle} className="f-body">
          Confirm new password
        </label>
        <input
          id="reset-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value) }}
          onFocus={() => { setFocusedField('confirmPassword') }}
          onBlur={() => { setFocusedField(null) }}
          style={{
            ...inputStyle,
            ...(focusedField === 'confirmPassword' ? inputFocusStyle : {}),
            ...(errors.confirmPassword ? inputErrorStyle : {}),
          }}
          aria-describedby={errors.confirmPassword ? 'reset-confirm-password-error' : undefined}
          aria-invalid={!!errors.confirmPassword}
          placeholder="Repeat your new password"
          disabled={isLoading}
        />
        {errors.confirmPassword && (
          <p id="reset-confirm-password-error" role="alert" style={errorTextStyle} className="f-body">
            {errors.confirmPassword}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        style={{
          width: '100%',
          background: isLoading ? 'rgba(230,126,80,0.6)' : '#E67E50',
          borderRadius: '14px',
          padding: '14px',
          color: 'white',
          fontSize: '15px',
          fontWeight: 600,
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
        }}
        className="f-body"
      >
        {isLoading ? 'Updating...' : 'Set new password'}
      </button>

      <p
        style={{
          textAlign: 'center',
          marginTop: '24px',
          color: 'rgba(10,46,77,0.5)',
          fontSize: '14px',
        }}
        className="f-body"
      >
        <Link
          href="/login"
          style={{ color: '#0A2E4D', fontWeight: 600, textDecoration: 'none' }}
        >
          Back to sign in
        </Link>
      </p>

    </form>
  )
}
