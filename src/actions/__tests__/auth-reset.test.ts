/**
 * FA-M.15 — password reset: the send is awaited, the email link never verifies on GET, and the
 * landing page's button (confirmPasswordReset) is the one place the token is used.
 *
 * Unit level: Supabase clients and the email module are mocked. The same flow against the real
 * local Auth is in guide-accounts.test.ts ("password reset").
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  generateLink:          vi.fn(),
  verifyOtp:             vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getClaims:             vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({ auth: { admin: { generateLink: h.generateLink } } })),
  createClient: vi.fn(async () => ({
    auth: {
      verifyOtp:              h.verifyOtp,
      exchangeCodeForSession: h.exchangeCodeForSession,
      getClaims:              h.getClaims,
    },
  })),
}))
vi.mock('@/lib/email', () => ({ sendPasswordResetEmail: h.sendPasswordResetEmail }))
vi.mock('@/lib/app-url', () => ({ getAppUrl: async () => 'https://app.test' }))

/** next/navigation's redirect() throws; the mock throws something the test can read. */
class Redirect extends Error {
  constructor(readonly url: string) { super(`redirect ${url}`) }
}
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Redirect(url) },
}))
vi.mock('next/image', () => ({
  default: (props: { alt: string; src: string }) => createElement('img', { alt: props.alt, src: props.src }),
}))

import { resetPassword, confirmPasswordReset } from '@/actions/auth'
import { GET } from '@/app/auth/reset/route'
import ResetConfirmPage from '@/app/auth/reset/confirm/page'
import ForgotPasswordPage from '@/app/forgot-password/page'

const NEUTRAL = "We couldn't send the email right now. Please try again in a minute."
const TOKEN = 'a3f1'.repeat(14) // shape of a hashed_token: hex

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  h.generateLink.mockResolvedValue({ data: { properties: { hashed_token: TOKEN } }, error: null })
  h.sendPasswordResetEmail.mockResolvedValue(undefined)
  h.getClaims.mockResolvedValue({ data: null, error: null })
})

async function redirectOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (err) {
    if (err instanceof Redirect) return err.url
    throw err
  }
  throw new Error('expected a redirect')
}

function form(tokenHash: string | null): FormData {
  const f = new FormData()
  if (tokenHash != null) f.set('token_hash', tokenHash)
  return f
}

// ─── resetPassword ────────────────────────────────────────────────────────────

describe('resetPassword (FA-M.15)', () => {
  it('send rejects (after sendEmail gave up) → the form gets the neutral error', async () => {
    h.sendPasswordResetEmail.mockRejectedValue(new TypeError('fetch failed'))

    expect(await resetPassword('guide@test.example')).toEqual({ error: NEUTRAL })
    expect(h.sendPasswordResetEmail).toHaveBeenCalledOnce()
  })

  it('waits for the send before answering', async () => {
    let finish: () => void = () => {}
    h.sendPasswordResetEmail.mockImplementation(() => new Promise<void>(r => { finish = r }))

    let answered = false
    const pending = resetPassword('guide@test.example').then(res => { answered = true; return res })
    await vi.waitFor(() => expect(h.sendPasswordResetEmail).toHaveBeenCalledOnce())
    await new Promise(r => setTimeout(r, 20))
    expect(answered).toBe(false)

    finish()
    expect(await pending).toEqual({ success: true })
  })

  it('sends the landing link built from the hashed token', async () => {
    expect(await resetPassword('guide@test.example')).toEqual({ success: true })
    expect(h.sendPasswordResetEmail).toHaveBeenCalledWith({
      to:       'guide@test.example',
      resetUrl: `https://app.test/auth/reset?token_hash=${TOKEN}&type=recovery`,
    })
  })

  it('unknown email → success, nothing sent (no account enumeration)', async () => {
    h.generateLink.mockResolvedValue({ data: { properties: null, user: null }, error: { message: 'User with this email not found' } })

    expect(await resetPassword('nobody@test.example')).toEqual({ success: true })
    expect(h.sendPasswordResetEmail).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })
})

// ─── GET /auth/reset ─────────────────────────────────────────────────────────

describe('GET /auth/reset (FA-M.15)', () => {
  it('with token_hash: does not call verifyOtp, forwards to the landing page with the token', async () => {
    const res = await GET(new NextRequest(`https://app.test/auth/reset?token_hash=${TOKEN}&type=recovery`))

    expect(h.verifyOtp).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBe(`https://app.test/auth/reset/confirm?token_hash=${TOKEN}&type=recovery`)
  })

  it('the same link opened twice: still no verifyOtp, same landing both times', async () => {
    const url = `https://app.test/auth/reset?token_hash=${TOKEN}&type=recovery`
    const a = await GET(new NextRequest(url))
    const b = await GET(new NextRequest(url))

    expect(h.verifyOtp).not.toHaveBeenCalled()
    expect(b.headers.get('location')).toBe(a.headers.get('location'))
  })

  it('PKCE code fallback works as before: exchange → /reset-password', async () => {
    h.exchangeCodeForSession.mockResolvedValue({ error: null })
    const res = await GET(new NextRequest('https://app.test/auth/reset?code=abc'))

    expect(h.exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(res.headers.get('location')).toBe('https://app.test/reset-password')
  })

  it('PKCE code that fails → /forgot-password?error=invalid_link', async () => {
    h.exchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid' } })
    const res = await GET(new NextRequest('https://app.test/auth/reset?code=bad'))

    expect(res.headers.get('location')).toBe('https://app.test/forgot-password?error=invalid_link')
  })

  it('no token, no code → /forgot-password?error=invalid_link', async () => {
    const res = await GET(new NextRequest('https://app.test/auth/reset'))
    expect(res.headers.get('location')).toBe('https://app.test/forgot-password?error=invalid_link')
  })
})

// ─── Landing page ─────────────────────────────────────────────────────────────

describe('/auth/reset/confirm landing page (FA-M.15)', () => {
  it('renders one "Set new password" button posting the token; verifies nothing', async () => {
    const page = await ResetConfirmPage({ searchParams: Promise.resolve({ token_hash: TOKEN, type: 'recovery' }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('Set new password')
    expect(html).toContain(`name="token_hash" value="${TOKEN}"`)
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(h.verifyOtp).not.toHaveBeenCalled()
    expect(h.getClaims).not.toHaveBeenCalled()
  })

  it('without a token → /forgot-password?error=invalid_link', async () => {
    expect(await redirectOf(() => ResetConfirmPage({ searchParams: Promise.resolve({ type: 'recovery' }) })))
      .toBe('/forgot-password?error=invalid_link')
  })
})

// ─── confirmPasswordReset (the button) ───────────────────────────────────────

describe('confirmPasswordReset (FA-M.15)', () => {
  it('valid token → verifyOtp(recovery) once → /reset-password', async () => {
    h.verifyOtp.mockResolvedValue({ error: null })

    expect(await redirectOf(() => confirmPasswordReset(form(TOKEN)))).toBe('/reset-password')
    expect(h.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: TOKEN, type: 'recovery' })
  })

  it('token already used, but this browser holds the recovery (otp) session → /reset-password', async () => {
    h.verifyOtp.mockResolvedValue({ error: { message: 'Email link is invalid or has expired', code: 'otp_expired' } })
    h.getClaims.mockResolvedValue({ data: { claims: { amr: [{ method: 'otp', timestamp: 1 }] } }, error: null })

    expect(await redirectOf(() => confirmPasswordReset(form(TOKEN)))).toBe('/reset-password')
  })

  it('token used/expired and no session → /forgot-password?error=invalid_link', async () => {
    h.verifyOtp.mockResolvedValue({ error: { message: 'Email link is invalid or has expired', code: 'otp_expired' } })

    expect(await redirectOf(() => confirmPasswordReset(form(TOKEN)))).toBe('/forgot-password?error=invalid_link')
  })

  it('token expired and only a password session (not from this flow) → /forgot-password?error=invalid_link', async () => {
    h.verifyOtp.mockResolvedValue({ error: { message: 'expired', code: 'otp_expired' } })
    h.getClaims.mockResolvedValue({ data: { claims: { amr: [{ method: 'password', timestamp: 1 }] } }, error: null })

    expect(await redirectOf(() => confirmPasswordReset(form(TOKEN)))).toBe('/forgot-password?error=invalid_link')
  })

  it('no token in the form → no verifyOtp, /forgot-password?error=invalid_link', async () => {
    expect(await redirectOf(() => confirmPasswordReset(form(null)))).toBe('/forgot-password?error=invalid_link')
    expect(h.verifyOtp).not.toHaveBeenCalled()
  })
})

// ─── /forgot-password after a dead link ──────────────────────────────────────

describe('/forgot-password?error=invalid_link (FA-M.15)', () => {
  it('shows the existing message and a "Send a new link" form', async () => {
    const html = renderToStaticMarkup(await ForgotPasswordPage({ searchParams: Promise.resolve({ error: 'invalid_link' }) }))

    expect(html).toContain('This reset link is invalid or has expired. Please request a new one.')
    expect(html).toContain('Send a new link')
    expect(html).toContain('id="forgot-email"')
  })

  it('without the error the page reads as before', async () => {
    const html = renderToStaticMarkup(await ForgotPasswordPage({ searchParams: Promise.resolve({}) }))

    expect(html).toContain('Forgot your password?')
    expect(html).toContain('Send reset link')
    expect(html).not.toContain('Send a new link')
  })
})
