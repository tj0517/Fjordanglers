'use client'

import { useState } from 'react'
import Link from 'next/link'
import { acceptGuideInvite, claimGuideInvite } from '@/actions/guide-invites'

type Props = {
  token: string
  guideName: string
  email: string
  signedIn: boolean
}

const font = 'var(--font-dm-sans, DM Sans, sans-serif)'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#fff',
  border: '1.5px solid rgba(10,46,77,0.14)',
  borderRadius: '14px',
  padding: '13px 16px',
  fontSize: '14px',
  color: '#0A2E4D',
  fontFamily: font,
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#0A2E4D',
  fontSize: '12px',
  fontWeight: 600,
  marginBottom: '6px',
  fontFamily: font,
}

const buttonStyle: React.CSSProperties = {
  width: '100%',
  background: '#0A2E4D',
  color: '#fff',
  border: 'none',
  borderRadius: '14px',
  padding: '14px 16px',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: font,
}

function ErrorText({ msg }: { msg: string }) {
  return (
    <p role="alert" className="f-body" style={{ color: 'rgba(200,40,40,0.95)', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5 }}>
      {msg}
    </p>
  )
}

export function InviteForm({ token, guideName, email, signedIn }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [existingAccount, setExistingAccount] = useState(false)
  const [loading, setLoading] = useState(false)

  const firstName = guideName.split(' ')[0] ?? ''
  const signInHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    setError(null)
    const res = await acceptGuideInvite(token, password)
    if ('success' in res) {
      window.location.href = '/dashboard'
      return
    }
    if ('existingAccount' in res) {
      setExistingAccount(true)
    } else {
      setError(res.error)
    }
    setLoading(false)
  }

  async function handleClaim() {
    setLoading(true)
    setError(null)
    const res = await claimGuideInvite(token)
    if ('success' in res) {
      window.location.href = '/dashboard'
      return
    }
    setError(res.error)
    setLoading(false)
  }

  const heading = (
    <>
      <h1 className="f-display" style={{ color: '#0A2E4D', fontSize: '24px', fontWeight: 700, lineHeight: 1.25, margin: 0 }}>
        {firstName !== '' ? `Hi ${firstName} — welcome to FjordAnglers` : 'Welcome to FjordAnglers'}
      </h1>
      <p className="f-body" style={{ color: 'rgba(10,46,77,0.55)', fontSize: '14px', margin: '10px 0 24px', lineHeight: 1.55 }}>
        This is your guide account for <strong style={{ color: '#0A2E4D' }}>{guideName}</strong>.
        You&apos;ll see your assignments and calendar here.
      </p>
    </>
  )

  if (signedIn) {
    return (
      <div>
        {heading}
        {error != null && <ErrorText msg={error} />}
        <button type="button" style={buttonStyle} disabled={loading} onClick={() => { void handleClaim() }}>
          {loading ? 'Linking…' : 'Link this account to my listing'}
        </button>
      </div>
    )
  }

  if (existingAccount) {
    return (
      <div>
        {heading}
        <p className="f-body" style={{ color: '#0A2E4D', fontSize: '14px', margin: '0 0 20px', lineHeight: 1.55 }}>
          You already have an account with <strong>{email}</strong>. Sign in with it, and you&apos;ll come
          back here to link it to your listing.
        </p>
        <Link href={signInHref} style={{ ...buttonStyle, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { void handleCreate(e) }} noValidate>
      {heading}
      {error != null && <ErrorText msg={error} />}

      <div style={{ marginBottom: '16px' }}>
        <span style={labelStyle}>E-mail</span>
        <p className="f-body" style={{ ...inputStyle, background: 'rgba(10,46,77,0.04)', margin: 0 }}>{email}</p>
      </div>

      <label style={{ display: 'block', marginBottom: '16px' }}>
        <span style={labelStyle}>Choose a password</span>
        <input
          type="password" autoComplete="new-password" placeholder="Min. 8 characters"
          value={password} onChange={e => setPassword(e.target.value)} style={inputStyle}
        />
      </label>

      <label style={{ display: 'block', marginBottom: '24px' }}>
        <span style={labelStyle}>Repeat password</span>
        <input
          type="password" autoComplete="new-password" placeholder="Repeat your password"
          value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle}
        />
      </label>

      <button type="submit" style={buttonStyle} disabled={loading}>
        {loading ? 'Setting up…' : 'Create my account'}
      </button>
    </form>
  )
}
