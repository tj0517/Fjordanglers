'use client'

/**
 * RegisterForm — full name, email, password, confirm password sign-up form.
 *
 * Calls the signUp Server Action. On success renders a "Check your email"
 * confirmation state in-place (no navigation, per spec).
 */

import { useState } from 'react'
import Link from 'next/link'
import { signUp } from '@/actions/auth'

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(10,46,77,0.04)',
  border: '1px solid rgba(10,46,77,0.12)',
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
  border: '1px solid rgba(220,50,50,0.2)',
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
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
  form?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RegisterForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setErrors({})

    const result = await signUp(fullName.trim(), email.trim(), password)

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
            <path
              d="M20 6L9 17L4 12"
              stroke="#E67E50"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
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
          Check your email
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
          We sent a confirmation link to{' '}
          <strong style={{ color: '#0A2E4D', fontWeight: 600 }}>{email}</strong>.
          Click it to activate your account.
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

      {/* Full name */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="register-fullname" style={labelStyle} className="f-body">
          Full name
        </label>
        <input
          id="register-fullname"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => { setFullName(e.target.value) }}
          onFocus={() => { setFocusedField('fullName') }}
          onBlur={() => { setFocusedField(null) }}
          style={{
            ...inputStyle,
            ...(focusedField === 'fullName' ? inputFocusStyle : {}),
            ...(errors.fullName ? inputErrorStyle : {}),
          }}
          aria-describedby={errors.fullName ? 'register-fullname-error' : undefined}
          aria-invalid={!!errors.fullName}
          placeholder="Erik Andersen"
          disabled={isLoading}
        />
        {errors.fullName && (
          <p id="register-fullname-error" role="alert" style={errorTextStyle} className="f-body">
            {errors.fullName}
          </p>
        )}
      </div>

      {/* Email */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="register-email" style={labelStyle} className="f-body">
          Email address
        </label>
        <input
          id="register-email"
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
          aria-describedby={errors.email ? 'register-email-error' : undefined}
          aria-invalid={!!errors.email}
          placeholder="you@example.com"
          disabled={isLoading}
        />
        {errors.email && (
          <p id="register-email-error" role="alert" style={errorTextStyle} className="f-body">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="register-password" style={labelStyle} className="f-body">
          Password
        </label>
        <input
          id="register-password"
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
          aria-describedby={errors.password ? 'register-password-error' : undefined}
          aria-invalid={!!errors.password}
          placeholder="Min. 8 characters"
          disabled={isLoading}
        />
        {errors.password && (
          <p id="register-password-error" role="alert" style={errorTextStyle} className="f-body">
            {errors.password}
          </p>
        )}
      </div>

      {/* Confirm password */}
      <div style={{ marginBottom: '28px' }}>
        <label htmlFor="register-confirm-password" style={labelStyle} className="f-body">
          Confirm password
        </label>
        <input
          id="register-confirm-password"
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
          aria-describedby={errors.confirmPassword ? 'register-confirm-password-error' : undefined}
          aria-invalid={!!errors.confirmPassword}
          placeholder="Repeat your password"
          disabled={isLoading}
        />
        {errors.confirmPassword && (
          <p id="register-confirm-password-error" role="alert" style={errorTextStyle} className="f-body">
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
        {isLoading ? 'Creating account...' : 'Create account'}
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
        Already have an account?{' '}
        <Link
          href="/login"
          style={{ color: '#0A2E4D', fontWeight: 600, textDecoration: 'none' }}
        >
          Sign in
        </Link>
      </p>

    </form>
  )
}
