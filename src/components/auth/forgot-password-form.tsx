'use client'

/**
 * ForgotPasswordForm — email input to trigger password reset email.
 *
 * Calls resetPassword Server Action. On success renders an in-place
 * "Check your inbox" confirmation message.
 */

import { useState } from 'react'
import Link from 'next/link'
import { resetPassword } from '@/actions/auth'

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

// ─── Component ────────────────────────────────────────────────────────────────

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ email?: string; form?: string }>({})
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  function validate(): boolean {
    const next: { email?: string } = {}

    if (!email.trim()) {
      next.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Please enter a valid email address.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setErrors({})

    const result = await resetPassword(email.trim())

    if ('error' in result) {
      setErrors({ form: result.error })
      setIsLoading(false)
      return
    }

    setIsSuccess(true)
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#E67E50" strokeWidth="2" />
            <path
              d="M2 8l10 7 10-7"
              stroke="#E67E50"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
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
          Check your inbox
        </h2>
        <p
          style={{
            color: 'rgba(10,46,77,0.55)',
            fontSize: '15px',
            lineHeight: 1.6,
            marginBottom: '32px',
          }}
          className="f-body"
        >
          If an account exists for{' '}
          <strong style={{ color: '#0A2E4D', fontWeight: 600 }}>{email}</strong>, you will
          receive a password reset link shortly.
        </p>
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            color: '#E67E50',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
          className="f-body"
        >
          Back to sign in
        </Link>
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

      {/* Email */}
      <div style={{ marginBottom: '28px' }}>
        <label htmlFor="forgot-email" style={labelStyle} className="f-body">
          Email address
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value) }}
          onFocus={() => { setFocusedField('email') }}
          onBlur={() => { setFocusedField(null) }}
          style={{
            ...inputStyle,
            ...(focusedField === 'email' ? inputFocusStyle : {}),
            ...(errors.email ? inputErrorStyle : {}),
          }}
          aria-describedby={errors.email ? 'forgot-email-error' : undefined}
          aria-invalid={!!errors.email}
          placeholder="you@example.com"
          disabled={isLoading}
        />
        {errors.email && (
          <p id="forgot-email-error" role="alert" style={errorTextStyle} className="f-body">
            {errors.email}
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
        {isLoading ? 'Sending...' : 'Send reset link'}
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
