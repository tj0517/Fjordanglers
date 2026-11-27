/**
 * /auth/reset/confirm — landing page of the password-reset email link (FA-M.15).
 *
 * GET /auth/reset?token_hash=…&type=recovery forwards here. This page verifies nothing:
 * it renders one button, and only its POST (confirmPasswordReset) calls verifyOtp. So a
 * refresh, a second request or a mail scanner opening the link leaves the token unused.
 *
 * The token is in the query string, so the page is on THIRD_PARTY_FREE_ROUTES (no Google /
 * Meta / Clarity script), sends no referrer and is not indexed.
 */

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { confirmPasswordReset } from '@/actions/auth'
import { SetNewPasswordButton } from '@/components/auth/set-new-password-button'

// ─── METADATA ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Reset your password — FjordAnglers',
  description: 'Set a new password for your FjordAnglers account.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default async function ResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[]; type?: string | string[] }>
}) {
  const { token_hash: tokenHash, type } = await searchParams

  if (typeof tokenHash !== 'string' || tokenHash === '' || type !== 'recovery') {
    redirect('/forgot-password?error=invalid_link')
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#F3EDE4' }}
    >

      {/* ─── TOP BAR ──────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/brand/dark-logo.png"
            alt="FjordAnglers"
            width={148}
            height={36}
            className="h-8 w-auto"
            priority
          />
        </Link>
        <Link
          href="/login"
          style={{
            color: '#0A2E4D',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
          className="f-body"
        >
          Sign in
        </Link>
      </header>

      {/* ─── CENTRED CARD ─────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div style={{ width: '100%', maxWidth: '440px' }}>

          <div
            style={{
              background: '#FDFAF7',
              border: '1px solid rgba(10,46,77,0.08)',
              borderRadius: '28px',
              boxShadow: '0 8px 40px rgba(4,12,22,0.1)',
              padding: '40px 36px',
            }}
          >
            <div style={{ marginBottom: '32px' }}>
              <p
                style={{
                  color: 'rgba(10,46,77,0.4)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '10px',
                }}
                className="f-body"
              >
                Account recovery
              </p>
              <h1
                style={{
                  color: '#0A2E4D',
                  fontSize: '26px',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  margin: 0,
                }}
                className="f-display"
              >
                Reset your password
              </h1>
              <p
                style={{
                  color: 'rgba(10,46,77,0.5)',
                  fontSize: '14px',
                  lineHeight: 1.55,
                  marginTop: '10px',
                  marginBottom: 0,
                }}
                className="f-body"
              >
                Continue to choose a new password for your account.
              </p>
            </div>

            <form action={confirmPasswordReset}>
              <input type="hidden" name="token_hash" value={tokenHash} />
              <SetNewPasswordButton />
            </form>
          </div>

        </div>
      </main>

      {/* ─── MINIMAL FOOTER ───────────────────────────────────────── */}
      <footer className="py-6 text-center">
        <p style={{ color: 'rgba(10,46,77,0.25)', fontSize: '12px' }} className="f-body">
          © 2026 FjordAnglers
        </p>
      </footer>

    </div>
  )
}
