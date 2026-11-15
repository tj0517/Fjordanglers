import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getGuideInviteByToken } from '@/actions/guide-invites'
import { InviteForm } from './InviteForm'

/**
 * /invite/<code> — a guide's one-time invite link (FA-M.08).
 *
 * The code is the credential: an open invite shows the listing name and the account e-mail
 * set by FA. Signed out → set a password (the account is created and bound on submit).
 * Signed in → "Link this account" (bound only if the account e-mail equals the invite e-mail).
 * Any unusable code — unknown, used, revoked, expired — shows one generic message.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your guide account — FjordAnglers',
  robots: { index: false, follow: false },
  // The code is in the URL: never send it to another site in a Referer header.
  referrer: 'no-referrer',
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await getGuideInviteByToken(token)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F3EDE4' }}>
      <header className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex-shrink-0">
          <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={148} height={36} className="h-8 w-auto" priority />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: '#FDFAF7',
            border: '1px solid rgba(10,46,77,0.08)',
            borderRadius: '28px',
            boxShadow: '0 8px 40px rgba(4,12,22,0.1)',
            padding: '40px 36px',
          }}
        >
          {invite == null ? (
            <div>
              <h1 className="f-display" style={{ color: '#0A2E4D', fontSize: '24px', fontWeight: 700, lineHeight: 1.25, margin: 0 }}>
                This link can&apos;t be used
              </h1>
              <p className="f-body" role="alert" style={{ color: 'rgba(10,46,77,0.6)', fontSize: '14px', marginTop: '12px', lineHeight: 1.55 }}>
                This invite link is no longer valid — ask FjordAnglers for a new one.
              </p>
              <p className="f-body" style={{ fontSize: '13px', marginTop: '20px' }}>
                <Link href="/login" style={{ color: '#0A2E4D', fontWeight: 600 }}>Already have a guide account? Sign in</Link>
              </p>
            </div>
          ) : (
            <InviteForm
              token={token}
              guideName={invite.guideName}
              email={invite.email}
              signedIn={user != null}
            />
          )}
        </div>
      </main>
    </div>
  )
}
