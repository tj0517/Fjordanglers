import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { AuthTabs } from '@/components/auth/auth-tabs'

export const metadata: Metadata = {
  title: 'Sign in — FjordAnglers',
  description: 'Sign in or create your FjordAnglers account.',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F3EDE4' }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex-shrink-0">
          <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={148} height={36} className="h-8 w-auto" priority />
        </Link>
      </header>

      {/* Centred card */}
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
            <div style={{ marginBottom: '28px' }}>
              <h1 style={{ color: '#0A2E4D', fontSize: '26px', fontWeight: 700, lineHeight: 1.2, margin: 0 }} className="f-display">
                Welcome to FjordAnglers
              </h1>
              <p style={{ color: 'rgba(10,46,77,0.42)', fontSize: '13px', marginTop: '8px' }} className="f-body">
                Sign in or create your account below.
              </p>
            </div>

            <Suspense fallback={<AuthSkeleton />}>
              <AuthTabs />
            </Suspense>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center">
        <p style={{ color: 'rgba(10,46,77,0.25)', fontSize: '12px' }} className="f-body">© 2026 FjordAnglers</p>
      </footer>

    </div>
  )
}

function AuthSkeleton() {
  return (
    <div style={{ opacity: 0.4 }}>
      <div style={{ height: '44px', background: '#F3EDE4', borderRadius: '16px', marginBottom: '28px' }} />
      <div style={{ height: '46px', background: 'rgba(10,46,77,0.04)', borderRadius: '12px', marginBottom: '20px' }} />
      <div style={{ height: '46px', background: 'rgba(10,46,77,0.04)', borderRadius: '12px', marginBottom: '28px' }} />
      <div style={{ height: '48px', background: 'rgba(230,126,80,0.6)', borderRadius: '14px' }} />
    </div>
  )
}
