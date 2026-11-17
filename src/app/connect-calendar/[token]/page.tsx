/**
 * /connect-calendar/[token] — "Connect with your calendar" (FA-M.09). Opened from a one-time link FA
 * sends on WhatsApp; no sign-in, the token is the credential. Opening the page writes nothing and
 * does not use the link up — only a successful connect does (tj D5). Every refused link (wrong,
 * revoked, used, expired) renders the same not-found page, with no guide data.
 *
 * Layout and copy follow docs/design/fa-m-guide-app/Connect.dc.html; where the task differs, the
 * task wins (tj 2026-11-17): Google is shown disabled with "Soon" until FA-M.10, and Mac steps sit
 * next to the iPhone steps. No back arrow: outside the account there is no Calendar screen to go to.
 * No third-party script is loaded here (THIRD_PARTY_FREE_ROUTES).
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connectLinkRefusal } from '@/lib/calendar/connections'
import { calendarLinkKey } from '@/lib/calendar/link-crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { ConnectPanel } from './ConnectPanel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Connect your calendar',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function ConnectCalendarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const refusal = await connectLinkRefusal(createServiceClient(), token)
  if (refusal != null) notFound()

  return (
    <main className="min-h-screen px-5 py-6" style={{ background: '#F8FAFB' }}>
      <div className="w-full max-w-md mx-auto">
        <ConnectPanel token={token} available={calendarLinkKey().ok} />
      </div>
    </main>
  )
}
