/**
 * /forgot-password — Password reset request page.
 *
 * Server Component wrapper: light sand background, centred card layout.
 * Delegates all form logic to the ForgotPasswordForm Client Component.
 */

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

// ─── METADATA ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Forgot password — FjordAnglers',
  description: 'Reset your FjordAnglers account password.',
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
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

          {/* Card */}
          <div
            style={{
              background: '#FDFAF7',
              border: '1px solid rgba(10,46,77,0.08)',
              borderRadius: '28px',
              boxShadow: '0 8px 40px rgba(4,12,22,0.1)',
              padding: '40px 36px',
            }}
          >
            {/* Card header */}
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
                Forgot your password?
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
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            <ForgotPasswordForm />
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
