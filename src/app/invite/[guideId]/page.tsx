/**
 * /invite/[guideId] — Guide invite registration page.
 *
 * Admin creates a beta guide listing, copies the invite link from the
 * admin panel, and sends it to the guide (email, WhatsApp, etc.).
 *
 * The guide opens the link, sees their pre-built profile, and registers
 * with any email address they choose. On email confirmation, /auth/callback
 * reads ?claim=GUID and pins their new account to this listing automatically.
 *
 * No invite_email matching required — the guideId is the token.
 *
 * Access rules:
 *   - Guide profile must exist
 *   - If user_id is already set → profile already claimed → redirect to /login
 */

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClaimGuideForm } from '@/components/auth/claim-guide-form'
import { User, Check } from 'lucide-react'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ guideId: string }>
}): Promise<Metadata> {
  const { guideId } = await params
  const supabase = await createClient()

  const { data: guide } = await supabase
    .from('guides')
    .select('full_name')
    .eq('id', guideId)
    .single()

  return {
    title: guide != null
      ? `Claim your profile — ${guide.full_name} — FjordAnglers`
      : 'Guide Invite — FjordAnglers',
  }
}

export default async function GuideInvitePage({
  params,
}: {
  params: Promise<{ guideId: string }>
}) {
  const { guideId } = await params
  const supabase = await createClient()

  // ── Fetch guide (public fields only) ─────────────────────────────────────
  const { data: guide } = await supabase
    .from('guides')
    .select('id, full_name, country, city, avatar_url, user_id, fish_expertise')
    .eq('id', guideId)
    .single()

  if (guide == null) notFound()

  // Already claimed — redirect with a clear notice
  if (guide.user_id != null) {
    redirect('/login?notice=invite_already_claimed')
  }

  const locationParts = [guide.city, guide.country].filter(Boolean)
  const location = locationParts.join(', ')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F3EDE4' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
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
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div style={{ width: '100%', maxWidth: '440px' }}>

          {/* Hero text */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(230,126,80,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              {/* Pin / anchor icon */}
              <User size={22} strokeWidth={1.8} aria-hidden="true" style={{ color: '#E67E50' }} />
            </div>
            <h1
              className="f-display"
              style={{ color: '#0A2E4D', fontSize: '24px', fontWeight: 700, lineHeight: 1.2, margin: '0 0 8px' }}
            >
              You&apos;ve been invited
            </h1>
            <p
              className="f-body"
              style={{ color: 'rgba(10,46,77,0.5)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}
            >
              Create your account to claim your guide profile on FjordAnglers.
            </p>
          </div>

          {/* ── Card ── */}
          <div
            style={{
              background: '#FDFAF7',
              border: '1px solid rgba(10,46,77,0.08)',
              borderRadius: '28px',
              boxShadow: '0 8px 40px rgba(4,12,22,0.1)',
              padding: '36px 36px',
            }}
          >
            {/* Guide profile preview */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px',
                borderRadius: '18px',
                background: 'rgba(10,46,77,0.025)',
                border: '1px solid rgba(10,46,77,0.08)',
                marginBottom: '28px',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '1.5px solid rgba(10,46,77,0.1)',
                  background: '#0A2E4D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {guide.avatar_url != null ? (
                  <Image
                    src={guide.avatar_url}
                    alt={guide.full_name}
                    width={52}
                    height={52}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ color: '#fff', fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)' }}>
                    {guide.full_name[0]}
                  </span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  className="f-display"
                  style={{ margin: 0, color: '#0A2E4D', fontSize: '15px', fontWeight: 700 }}
                >
                  {guide.full_name}
                </p>
                {location && (
                  <p
                    className="f-body"
                    style={{ margin: 0, color: 'rgba(10,46,77,0.45)', fontSize: '12px', marginTop: '1px' }}
                  >
                    {location}
                  </p>
                )}
                {guide.fish_expertise.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '5px' }}>
                    {guide.fish_expertise.slice(0, 3).map((fish: string) => (
                      <span
                        key={fish}
                        className="f-body"
                        style={{
                          fontSize: '9px',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '20px',
                          background: 'rgba(201,96,48,0.08)',
                          color: '#9E4820',
                        }}
                      >
                        {fish}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Verified badge */}
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: 'rgba(74,222,128,0.1)',
                  color: '#16A34A',
                  fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
                }}
              >
                <Check size={8} strokeWidth={1.5} aria-hidden="true" />
                Verified
              </div>
            </div>

            <ClaimGuideForm guideId={guide.id} />
          </div>

          {/* Footer */}
          <p
            className="f-body"
            style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(10,46,77,0.35)', fontSize: '12px', lineHeight: 1.6 }}
          >
            Already have an account?{' '}
            <Link
              href="/login"
              style={{ color: 'rgba(10,46,77,0.6)', fontWeight: 600, textDecoration: 'none' }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>

      <footer className="py-6 text-center">
        <p style={{ color: 'rgba(10,46,77,0.25)', fontSize: '12px' }} className="f-body">
          © 2026 FjordAnglers
        </p>
      </footer>

    </div>
  )
}
