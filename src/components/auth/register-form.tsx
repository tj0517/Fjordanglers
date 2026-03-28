'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signUp } from '@/actions/auth'
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'angler' | 'guide'

type FieldErrors = {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
  form?: string
}

// ─── Role cards ───────────────────────────────────────────────────────────────

const ROLES: { key: Role; icon: string; title: string; desc: string }[] = [
  {
    key: 'angler',
    icon: '🎣',
    title: 'I\'m an angler',
    desc: 'Find & book guided fishing trips',
  },
  {
    key: 'guide',
    icon: '🗺',
    title: 'I\'m a guide',
    desc: 'List your trips & earn',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function RegisterForm() {
  const router = useRouter()
  const [role, setRole] = useState<Role>('angler')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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

    const result = await signUp(fullName.trim(), email.trim(), password, role)

    if ('error' in result) {
      setErrors({ form: result.error })
      setIsLoading(false)
      return
    }

    router.push(role === 'guide' ? '/dashboard' : '/account')
  }

  // ─── Form state ─────────────────────────────────────────────────────────────

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} noValidate>

      {/* ── Google ─────────────────────────────────────────────────────────── */}
      <GoogleAuthButton label="Sign up with Google" />

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(10,46,77,0.08)' }} />
        <span style={{ color: 'rgba(10,46,77,0.3)', fontSize: '12px', fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)' }}>or sign up with email</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(10,46,77,0.08)' }} />
      </div>

      {/* ── Role selector ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '28px' }}>
        {ROLES.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRole(r.key)}
            style={{
              background: role === r.key ? '#0A2E4D' : 'rgba(10,46,77,0.04)',
              border: role === r.key ? '1.5px solid #0A2E4D' : '1.5px solid rgba(10,46,77,0.12)',
              borderRadius: '16px',
              padding: '16px 12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left' as const,
            }}
          >
            <span style={{ fontSize: '22px', display: 'block', marginBottom: '8px' }}>{r.icon}</span>
            <p
              style={{
                color: role === r.key ? '#fff' : '#0A2E4D',
                fontSize: '13px',
                fontWeight: 700,
                margin: 0,
                marginBottom: '2px',
                fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
              }}
            >
              {r.title}
            </p>
            <p
              style={{
                color: role === r.key ? 'rgba(255,255,255,0.6)' : 'rgba(10,46,77,0.4)',
                fontSize: '11px',
                margin: 0,
                fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
                lineHeight: 1.4,
              }}
            >
              {r.desc}
            </p>
          </button>
        ))}
      </div>

      {/* ── Form-level error ───────────────────────────────────────────────── */}
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

      {/* ── Full name ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="register-fullname" style={labelStyle} className="f-body">Full name</label>
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
          placeholder="Erik Andersen"
          disabled={isLoading}
          aria-invalid={!!errors.fullName}
        />
        {errors.fullName && <p role="alert" style={errorTextStyle} className="f-body">{errors.fullName}</p>}
      </div>

      {/* ── Email ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="register-email" style={labelStyle} className="f-body">Email address</label>
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
          placeholder="you@example.com"
          disabled={isLoading}
          aria-invalid={!!errors.email}
        />
        {errors.email && <p role="alert" style={errorTextStyle} className="f-body">{errors.email}</p>}
      </div>

      {/* ── Password ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="register-password" style={labelStyle} className="f-body">Password</label>
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
          placeholder="Min. 8 characters"
          disabled={isLoading}
          aria-invalid={!!errors.password}
        />
        {errors.password && <p role="alert" style={errorTextStyle} className="f-body">{errors.password}</p>}
      </div>

      {/* ── Confirm password ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <label htmlFor="register-confirm-password" style={labelStyle} className="f-body">Confirm password</label>
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
          placeholder="Repeat your password"
          disabled={isLoading}
          aria-invalid={!!errors.confirmPassword}
        />
        {errors.confirmPassword && <p role="alert" style={errorTextStyle} className="f-body">{errors.confirmPassword}</p>}
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
        }}
        className="f-body"
      >
        {isLoading
          ? 'Creating account…'
          : role === 'guide'
            ? 'Create guide account'
            : 'Create angler account'}
      </button>

      <p
        style={{ textAlign: 'center', marginTop: '24px', color: 'rgba(10,46,77,0.5)', fontSize: '14px' }}
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
