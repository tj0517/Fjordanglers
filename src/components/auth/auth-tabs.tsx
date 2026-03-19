'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn, signUp } from '@/actions/auth'
import { GoogleAuthButton } from '@/components/auth/google-auth-button'

// ─── Styles ───────────────────────────────────────────────────────────────────

const font = 'var(--font-dm-sans, DM Sans, sans-serif)'

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
  fontFamily: font,
  outline: 'none',
  transition: 'border-color 0.15s ease',
}

const inputFocusStyle: React.CSSProperties = { borderColor: 'rgba(230,126,80,0.55)' }
const inputErrorStyle: React.CSSProperties = { background: 'rgba(220,50,50,0.08)', borderColor: 'rgba(220,50,50,0.2)' }

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(10,46,77,0.4)',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  marginBottom: '8px',
  fontFamily: font,
}

const errorTextStyle: React.CSSProperties = {
  color: 'rgba(220,50,50,0.9)',
  fontSize: '12px',
  marginTop: '6px',
  fontFamily: font,
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'login' | 'register'
type Role = 'angler' | 'guide'

const CALLBACK_ERRORS: Record<string, string> = {
  auth_callback_failed: 'The confirmation link has expired or is invalid. Please try again.',
}

const ROLES: { key: Role; icon: string; title: string; desc: string }[] = [
  { key: 'angler', icon: '🎣', title: "I'm an angler", desc: 'Find & book guided fishing trips' },
  { key: 'guide',  icon: '🗺',  title: "I'm a guide",  desc: 'List your trips & earn' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function AuthTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialTab = (searchParams.get('tab') === 'register' ? 'register' : 'login') as Tab
  const nextUrl = searchParams.get('next') ?? '/dashboard'
  const callbackError = searchParams.get('error')
  const callbackErrorMsg = callbackError != null
    ? (CALLBACK_ERRORS[callbackError] ?? 'An authentication error occurred. Please try again.')
    : null

  const [tab, setTab] = useState<Tab>(initialTab)

  // ── Login state ──────────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginErrors, setLoginErrors]     = useState<{ email?: string; password?: string; form?: string }>({})
  const [loginLoading, setLoginLoading]   = useState(false)
  const [loginFocus, setLoginFocus]       = useState<string | null>(null)

  // ── Register state ───────────────────────────────────────────────────────
  const [role, setRole]                         = useState<Role>('angler')
  const [regName, setRegName]                   = useState('')
  const [regEmail, setRegEmail]                 = useState('')
  const [regPassword, setRegPassword]           = useState('')
  const [regConfirm, setRegConfirm]             = useState('')
  const [regErrors, setRegErrors]               = useState<Record<string, string>>({})
  const [regLoading, setRegLoading]             = useState(false)
  const [regFocus, setRegFocus]                 = useState<string | null>(null)
  const [regSuccess, setRegSuccess]             = useState(false)

  // ── Login submit ─────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof loginErrors = {}
    if (!loginEmail.trim()) errs.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) errs.email = 'Invalid email address.'
    if (!loginPassword) errs.password = 'Password is required.'
    if (Object.keys(errs).length) { setLoginErrors(errs); return }

    setLoginLoading(true)
    setLoginErrors({})
    const result = await signIn(loginEmail.trim(), loginPassword)
    if ('error' in result) {
      setLoginErrors({ form: result.error })
      setLoginLoading(false)
      return
    }
    router.push(nextUrl)
  }

  // ── Register submit ──────────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!regName.trim()) errs.fullName = 'Full name is required.'
    if (!regEmail.trim()) errs.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) errs.email = 'Invalid email address.'
    if (!regPassword) errs.password = 'Password is required.'
    else if (regPassword.length < 8) errs.password = 'Min 8 characters.'
    if (regPassword !== regConfirm) errs.confirmPassword = 'Passwords do not match.'
    if (Object.keys(errs).length) { setRegErrors(errs); return }

    setRegLoading(true)
    setRegErrors({})
    const result = await signUp(regName.trim(), regEmail.trim(), regPassword, role)
    if ('error' in result) {
      setRegErrors({ form: result.error })
      setRegLoading(false)
      return
    }
    setRegSuccess(true)
  }

  // ─── Register success ─────────────────────────────────────────────────────
  if (regSuccess) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(230,126,80,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="#E67E50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 style={{ color: '#0A2E4D', fontSize: '22px', fontWeight: 700, marginBottom: 12 }} className="f-display">Check your email</h2>
        <p style={{ color: 'rgba(10,46,77,0.55)', fontSize: '15px', lineHeight: 1.6, marginBottom: 32 }} className="f-body">
          We sent a confirmation link to <strong style={{ color: '#0A2E4D' }}>{regEmail}</strong>. Click it to activate your account.
        </p>
        <button type="button" onClick={() => { setRegSuccess(false); setTab('login') }} style={{ color: '#E67E50', fontSize: '14px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: font }} className="f-body">
          Back to sign in
        </button>
      </div>
    )
  }

  // ─── Tab toggle ───────────────────────────────────────────────────────────
  return (
    <div>
      {/* Tab switcher */}
      <div
        style={{ display: 'flex', background: '#F3EDE4', borderRadius: '16px', padding: '4px', gap: '4px', marginBottom: '28px' }}
      >
        {(['login', 'register'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: font,
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 0.15s ease',
              background: tab === t ? '#FDFAF7' : 'transparent',
              color: tab === t ? '#0A2E4D' : 'rgba(10,46,77,0.4)',
              boxShadow: tab === t ? '0 1px 6px rgba(10,46,77,0.08)' : 'none',
            }}
          >
            {t === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        ))}
      </div>

      {/* ─── LOG IN ─────────────────────────────────────────────────────────── */}
      {tab === 'login' && (
        <form onSubmit={(e) => { void handleLogin(e) }} noValidate>

          {callbackErrorMsg != null && <ErrorBox msg={callbackErrorMsg} />}
          {loginErrors.form != null && <ErrorBox msg={loginErrors.form} />}

          <GoogleAuthButton next={nextUrl} />

          <Divider label="or" />

          <Field label="Email address" error={loginErrors.email}>
            <input
              type="email" autoComplete="email" placeholder="you@example.com"
              value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
              onFocus={() => setLoginFocus('email')} onBlur={() => setLoginFocus(null)}
              disabled={loginLoading}
              style={{ ...inputStyle, ...(loginFocus === 'email' ? inputFocusStyle : {}), ...(loginErrors.email ? inputErrorStyle : {}) }}
            />
          </Field>

          <Field label="Password" error={loginErrors.password}>
            <input
              type="password" autoComplete="current-password" placeholder="Your password"
              value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
              onFocus={() => setLoginFocus('password')} onBlur={() => setLoginFocus(null)}
              disabled={loginLoading}
              style={{ ...inputStyle, ...(loginFocus === 'password' ? inputFocusStyle : {}), ...(loginErrors.password ? inputErrorStyle : {}) }}
            />
          </Field>

          <div style={{ textAlign: 'right', marginBottom: '28px', marginTop: '-8px' }}>
            <Link href="/forgot-password" style={{ color: '#E67E50', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }} className="f-body">
              Forgot password?
            </Link>
          </div>

          <SubmitButton loading={loginLoading} label="Sign in" loadingLabel="Signing in…" />
        </form>
      )}

      {/* ─── SIGN UP ────────────────────────────────────────────────────────── */}
      {tab === 'register' && (
        <form onSubmit={(e) => { void handleRegister(e) }} noValidate>

          {regErrors.form != null && <ErrorBox msg={regErrors.form} />}

          {/* Role selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
            {ROLES.map(r => (
              <button
                key={r.key} type="button" onClick={() => setRole(r.key)}
                style={{
                  background: role === r.key ? '#0A2E4D' : 'rgba(10,46,77,0.04)',
                  border: `1.5px solid ${role === r.key ? '#0A2E4D' : 'rgba(10,46,77,0.12)'}`,
                  borderRadius: '16px', padding: '16px 12px', cursor: 'pointer',
                  transition: 'all 0.15s ease', textAlign: 'left' as const,
                }}
              >
                <span style={{ fontSize: '22px', display: 'block', marginBottom: '8px' }}>{r.icon}</span>
                <p style={{ color: role === r.key ? '#fff' : '#0A2E4D', fontSize: '13px', fontWeight: 700, margin: '0 0 2px', fontFamily: font }}>{r.title}</p>
                <p style={{ color: role === r.key ? 'rgba(255,255,255,0.6)' : 'rgba(10,46,77,0.4)', fontSize: '11px', margin: 0, fontFamily: font, lineHeight: 1.4 }}>{r.desc}</p>
              </button>
            ))}
          </div>

          <GoogleAuthButton label="Sign up with Google" next={nextUrl} />

          <Divider label="or sign up with email" />

          <Field label="Full name" error={regErrors.fullName}>
            <input
              type="text" autoComplete="name" placeholder="Erik Andersen"
              value={regName} onChange={e => setRegName(e.target.value)}
              onFocus={() => setRegFocus('name')} onBlur={() => setRegFocus(null)}
              disabled={regLoading}
              style={{ ...inputStyle, ...(regFocus === 'name' ? inputFocusStyle : {}), ...(regErrors.fullName ? inputErrorStyle : {}) }}
            />
          </Field>

          <Field label="Email address" error={regErrors.email}>
            <input
              type="email" autoComplete="email" placeholder="you@example.com"
              value={regEmail} onChange={e => setRegEmail(e.target.value)}
              onFocus={() => setRegFocus('email')} onBlur={() => setRegFocus(null)}
              disabled={regLoading}
              style={{ ...inputStyle, ...(regFocus === 'email' ? inputFocusStyle : {}), ...(regErrors.email ? inputErrorStyle : {}) }}
            />
          </Field>

          <Field label="Password" error={regErrors.password}>
            <input
              type="password" autoComplete="new-password" placeholder="Min. 8 characters"
              value={regPassword} onChange={e => setRegPassword(e.target.value)}
              onFocus={() => setRegFocus('password')} onBlur={() => setRegFocus(null)}
              disabled={regLoading}
              style={{ ...inputStyle, ...(regFocus === 'password' ? inputFocusStyle : {}), ...(regErrors.password ? inputErrorStyle : {}) }}
            />
          </Field>

          <Field label="Confirm password" error={regErrors.confirmPassword}>
            <input
              type="password" autoComplete="new-password" placeholder="Repeat your password"
              value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
              onFocus={() => setRegFocus('confirm')} onBlur={() => setRegFocus(null)}
              disabled={regLoading}
              style={{ ...inputStyle, ...(regFocus === 'confirm' ? inputFocusStyle : {}), ...(regErrors.confirmPassword ? inputErrorStyle : {}) }}
            />
          </Field>

          <div style={{ marginBottom: '28px' }} />

          <SubmitButton
            loading={regLoading}
            label={role === 'guide' ? 'Create guide account' : 'Create angler account'}
            loadingLabel="Creating account…"
          />
        </form>
      )}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div role="alert" style={{ background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.2)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
      <p style={{ color: 'rgba(220,50,50,0.9)', fontSize: '14px', margin: 0, fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)' }} className="f-body">{msg}</p>
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
      <div style={{ flex: 1, height: '1px', background: 'rgba(10,46,77,0.08)' }} />
      <span style={{ color: 'rgba(10,46,77,0.3)', fontSize: '12px', fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)' }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: 'rgba(10,46,77,0.08)' }} />
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={labelStyle} className="f-body">{label}</label>
      {children}
      {error && <p role="alert" style={errorTextStyle} className="f-body">{error}</p>}
    </div>
  )
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit" disabled={loading}
      style={{ width: '100%', background: loading ? 'rgba(230,126,80,0.6)' : '#E67E50', borderRadius: '14px', padding: '14px', color: 'white', fontSize: '15px', fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease', fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)' }}
      className="f-body"
    >
      {loading ? loadingLabel : label}
    </button>
  )
}
