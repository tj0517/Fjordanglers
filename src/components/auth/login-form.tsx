'use client'

/**
 * LoginForm — email + password sign-in form.
 *
 * Calls the signIn Server Action, then redirects to /dashboard on success
 * (or the ?next= param set by middleware when protecting /dashboard routes).
 * Inline validation before submit; inline error display below each field.
 *
 * Must be wrapped in <Suspense> in the parent page because it uses useSearchParams().
 */

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/actions/auth'
import { GoogleAuthButton } from '@/components/auth/google-auth-button'

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

// ─── Callback error messages ──────────────────────────────────────────────────

const CALLBACK_ERRORS: Record<string, string> = {
  auth_callback_failed: 'The confirmation link has expired or is invalid. Please try again.',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoginForm() {
  const searchParams = useSearchParams()

  // Where to go after successful login — /account role-routes correctly:
  // guides → /dashboard, anglers → /account/bookings, admins → /admin
  const nextUrl = searchParams.get('next') ?? '/account'

  // Surface errors from the /auth/callback route (e.g. expired confirmation link)
  const callbackError = searchParams.get('error')
  const callbackErrorMsg = callbackError != null
    ? (CALLBACK_ERRORS[callbackError] ?? 'An authentication error occurred. Please try again.')
    : null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function validate(): boolean {
    const next: typeof errors = {}

    if (!email.trim()) {
      next.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Please enter a valid email address.'
    }

    if (!password) {
      next.password = 'Password is required.'
    } else if (password.length < 3) {
      next.password = 'Password must be at least 3 characters.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setErrors({})

    const result = await signIn(email.trim(), password)

    if ('error' in result) {
      setErrors({ form: result.error })
      setIsLoading(false)
      return
    }

    // Full page navigation — clears old client state and triggers loading.tsx
    // so there's no flash of personal/login data before the dashboard renders.
    window.location.href = nextUrl
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} noValidate>

      {/* Callback error (from /auth/callback redirect) */}
      {callbackErrorMsg != null && (
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
            {callbackErrorMsg}
          </p>
        </div>
      )}

      {/* Form-level error */}
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

      {/* Email */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="login-email" style={labelStyle} className="f-body">
          Email address
        </label>
        <input
          id="login-email"
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
          aria-describedby={errors.email != null ? 'login-email-error' : undefined}
          aria-invalid={errors.email != null}
          placeholder="you@example.com"
          disabled={isLoading}
        />
        {errors.email != null && (
          <p id="login-email-error" role="alert" style={errorTextStyle} className="f-body">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password */}
      <div style={{ marginBottom: '8px' }}>
        <label htmlFor="login-password" style={labelStyle} className="f-body">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value) }}
          onFocus={() => { setFocusedField('password') }}
          onBlur={() => { setFocusedField(null) }}
          style={{
            ...inputStyle,
            ...(focusedField === 'password' ? inputFocusStyle : {}),
            ...(errors.password != null ? inputErrorStyle : {}),
          }}
          aria-describedby={errors.password != null ? 'login-password-error' : undefined}
          aria-invalid={errors.password != null}
          placeholder="Min. 8 characters"
          disabled={isLoading}
        />
        {errors.password != null && (
          <p id="login-password-error" role="alert" style={errorTextStyle} className="f-body">
            {errors.password}
          </p>
        )}
      </div>

      {/* Forgot password */}
      <div style={{ textAlign: 'right', marginBottom: '28px' }}>
        <Link
          href="/forgot-password"
          style={{
            color: '#E67E50',
            fontSize: '13px',
            textDecoration: 'none',
            fontWeight: 500,
          }}
          className="f-body"
        >
          Forgot password?
        </Link>
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
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(10,46,77,0.08)' }} />
        <span style={{ color: 'rgba(10,46,77,0.3)', fontSize: '12px' }} className="f-body">or</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(10,46,77,0.08)' }} />
      </div>

      <GoogleAuthButton next={nextUrl} />

      <div style={{ marginTop: '24px' }} />

      {/* Secondary links */}
      <p style={{ textAlign: 'center', color: 'rgba(10,46,77,0.5)', fontSize: '14px' }} className="f-body">
        New to FjordAnglers?{' '}
        <Link
          href="/register"
          style={{ color: '#0A2E4D', fontWeight: 600, textDecoration: 'none' }}
        >
          Create account
        </Link>
      </p>

      <p style={{ textAlign: 'center', marginTop: '12px' }}>
        <Link
          href="/guides/apply"
          style={{ color: '#E67E50', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}
          className="f-body"
        >
          Join as a guide →
        </Link>
      </p>

    </form>
  )
}
