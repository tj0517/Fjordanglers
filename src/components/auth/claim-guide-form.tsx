'use client'

/**
 * ClaimGuideForm — registration form used on /invite/[guideId].
 *
 * Calls claimGuideProfile() which uses auth.admin.createUser() with
 * email_confirm: true — account is active immediately, no email step.
 *
 * On success shows a "Go to sign in" card. The guide then signs in
 * normally and lands on their dashboard.
 */

import { useState } from 'react'
import Link from 'next/link'
import { claimGuideProfile } from '@/actions/invite'

// ─── Styles (shared with RegisterForm) ────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldErrors = {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
  form?: string
}

type Props = {
  guideId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClaimGuideForm({ guideId }: Props) {
  const [fullName, setFullName]             = useState('')
  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors]                 = useState<FieldErrors>({})
  const [focusedField, setFocusedField]     = useState<string | null>(null)
  const [isLoading, setIsLoading]           = useState(false)
  const [successEmail, setSuccessEmail]     = useState<string | null>(null)

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: FieldErrors = {}

    if (!fullName.trim()) {
      next.fullName = 'Full name is required.'
    }
    if (!email.trim()) {
      next.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Please enter a valid email address.'
    }
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

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setErrors({})

    const result = await claimGuideProfile(guideId, fullName.trim(), email.trim(), password)

    if ('error' in result) {
      setErrors({ form: result.error })
      setIsLoading(false)
      return
    }

    setSuccessEmail(email.trim())
  }

  // ─── Success state ──────────────────────────────────────────────────────────

  if (successEmail != null) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        {/* Check icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(74,222,128,0.1)',
            border: '1.5px solid rgba(74,222,128,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 6L9 17L4 12"
              stroke="#16A34A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2
          className="f-display"
          style={{ color: '#0A2E4D', fontSize: '22px', fontWeight: 700, marginBottom: '10px', lineHeight: 1.2 }}
        >
          Profile claimed!
        </h2>
        <p
          className="f-body"
          style={{ color: 'rgba(10,46,77,0.55)', fontSize: '14px', lineHeight: 1.65, marginBottom: '8px' }}
        >
          Your guide account is ready. Sign in with{' '}
          <strong style={{ color: '#0A2E4D' }}>{successEmail}</strong>{' '}
          to access your dashboard.
        </p>
        <p
          className="f-body"
          style={{ color: 'rgba(10,46,77,0.38)', fontSize: '12px', lineHeight: 1.5, marginBottom: '32px' }}
        >
          No email confirmation needed — your account is active immediately.
        </p>

        <Link
          href="/login?next=/dashboard"
          style={{
            display: 'inline-block',
            background: '#E67E50',
            color: '#fff',
            padding: '12px 28px',
            borderRadius: '14px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
          }}
          className="f-body"
        >
          Sign in to your dashboard →
        </Link>
      </div>
    )
  }

  // ─── Form ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} noValidate>

      {/* ── Form-level error ───────────────────────────────────────────────── */}
      {errors.form != null && (
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

      {/* ── Full name ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '18px' }}>
        <label htmlFor="claim-fullname" style={labelStyle} className="f-body">Your full name</label>
        <input
          id="claim-fullname"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => { setFullName(e.target.value) }}
          onFocus={() => { setFocusedField('fullName') }}
          onBlur={() => { setFocusedField(null) }}
          style={{
            ...inputStyle,
            ...(focusedField === 'fullName' ? inputFocusStyle : {}),
            ...(errors.fullName != null ? inputErrorStyle : {}),
          }}
          placeholder="Erik Andersen"
          disabled={isLoading}
          aria-invalid={errors.fullName != null}
        />
        {errors.fullName != null && (
          <p role="alert" style={errorTextStyle} className="f-body">{errors.fullName}</p>
        )}
      </div>

      {/* ── Email ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '18px' }}>
        <label htmlFor="claim-email" style={labelStyle} className="f-body">Email address</label>
        <input
          id="claim-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value) }}
          onFocus={() => { setFocusedField('email') }}
          onBlur={() => { setFocusedField(null) }}
          style={{
            ...inputStyle,
            ...(focusedField === 'email' ? inputFocusStyle : {}),
            ...(errors.email != null ? inputErrorStyle : {}),
          }}
          placeholder="you@example.com"
          disabled={isLoading}
          aria-invalid={errors.email != null}
        />
        {errors.email != null && (
          <p role="alert" style={errorTextStyle} className="f-body">{errors.email}</p>
        )}
      </div>

      {/* ── Password ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '18px' }}>
        <label htmlFor="claim-password" style={labelStyle} className="f-body">Password</label>
        <input
          id="claim-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value) }}
          onFocus={() => { setFocusedField('password') }}
          onBlur={() => { setFocusedField(null) }}
          style={{
            ...inputStyle,
            ...(focusedField === 'password' ? inputFocusStyle : {}),
            ...(errors.password != null ? inputErrorStyle : {}),
          }}
          placeholder="Min. 8 characters"
          disabled={isLoading}
          aria-invalid={errors.password != null}
        />
        {errors.password != null && (
          <p role="alert" style={errorTextStyle} className="f-body">{errors.password}</p>
        )}
      </div>

      {/* ── Confirm password ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <label htmlFor="claim-confirm-password" style={labelStyle} className="f-body">Confirm password</label>
        <input
          id="claim-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value) }}
          onFocus={() => { setFocusedField('confirmPassword') }}
          onBlur={() => { setFocusedField(null) }}
          style={{
            ...inputStyle,
            ...(focusedField === 'confirmPassword' ? inputFocusStyle : {}),
            ...(errors.confirmPassword != null ? inputErrorStyle : {}),
          }}
          placeholder="Repeat your password"
          disabled={isLoading}
          aria-invalid={errors.confirmPassword != null}
        />
        {errors.confirmPassword != null && (
          <p role="alert" style={errorTextStyle} className="f-body">{errors.confirmPassword}</p>
        )}
      </div>

      {/* ── Submit ─────────────────────────────────────────────────────────── */}
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
        className="f-body"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
              <path d="M8 2a6 6 0 016 6" strokeLinecap="round" />
            </svg>
            Creating your account…
          </>
        ) : (
          'Claim your guide profile'
        )}
      </button>

      <p
        style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(10,46,77,0.45)', fontSize: '13px' }}
        className="f-body"
      >
        Already have an account?{' '}
        <Link href="/login" style={{ color: '#0A2E4D', fontWeight: 600, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>

    </form>
  )
}
