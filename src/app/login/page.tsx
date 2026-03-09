/**
 * /login — Sign in page.
 *
 * Server Component wrapper: light sand background, centred card layout.
 * Delegates all form logic to the LoginForm Client Component.
 *
 * LoginForm uses useSearchParams() so it must be wrapped in <Suspense>
 * to prevent the whole page from de-opting out of static rendering.
 */

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'

// ─── METADATA ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Sign in — FjordAnglers',
  description: 'Sign in to your FjordAnglers account.',
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
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
          href="/register"
          style={{
            color: '#0A2E4D',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
          className="f-body"
        >
          Create account
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
                Welcome back
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
                Sign in to your account
              </h1>
            </div>

            {/*
              Suspense boundary required because LoginForm reads useSearchParams()
              (?next= and ?error= query params set by middleware / auth/callback).
              The fallback renders the same card height so there's no layout shift.
            */}
            <Suspense fallback={<LoginFormSkeleton />}>
              <LoginForm />
            </Suspense>
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

// ─── Skeleton shown during Suspense hydration ─────────────────────────────────

function LoginFormSkeleton() {
  return (
    <div style={{ opacity: 0.4 }}>
      {/* Email field placeholder */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ height: '12px', width: '100px', background: 'rgba(10,46,77,0.1)', borderRadius: '6px', marginBottom: '8px' }} />
        <div style={{ height: '46px', background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.12)', borderRadius: '12px' }} />
      </div>
      {/* Password field placeholder */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ height: '12px', width: '72px', background: 'rgba(10,46,77,0.1)', borderRadius: '6px', marginBottom: '8px' }} />
        <div style={{ height: '46px', background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.12)', borderRadius: '12px' }} />
      </div>
      {/* Submit placeholder */}
      <div style={{ height: '48px', background: 'rgba(230,126,80,0.6)', borderRadius: '14px' }} />
    </div>
  )
}
