/**
 * /connect-calendar/done — where Google sends a guide who started from the signed link (FA-M.10,
 * tj STOP 1 decision 3). After a successful connect the link is used up, so the guide cannot go back
 * to it; this page says how it went and nothing else: no guide data, no token, no calendar contents.
 * Only `status` is read, from a fixed list. No third-party script (THIRD_PARTY_FREE_ROUTES).
 */

import type { Metadata } from 'next'
import { Check, CalendarX } from 'lucide-react'
import { z } from 'zod'

export const metadata: Metadata = {
  title: 'Connect your calendar',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

const NAVY = '#0A2E4D'
const MUTED = '#4A5F73'
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '48698936563'
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi FjordAnglers, I need help connecting my calendar.')}`

const statusSchema = z.enum(['connected', 'denied', 'error']).catch('error')

const COPY = {
  connected: {
    title: 'Google Calendar connected',
    body: [
      'We now see when you’re busy — never what’s in your calendar.',
      'We check it every few hours. You still confirm every request.',
    ],
  },
  denied: {
    title: 'Nothing was connected',
    body: [
      'You stopped on Google’s screen, so FjordAnglers has no access to your calendar.',
      'Changed your mind? Open the link we sent you on WhatsApp again.',
    ],
  },
  error: {
    title: 'That didn’t work',
    body: [
      'Your calendar wasn’t connected. Open the link we sent you on WhatsApp and try again.',
      'If the link no longer works, write to us and we’ll send a new one.',
    ],
  },
} as const

export default async function ConnectCalendarDonePage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const status = statusSchema.parse((await searchParams).status)
  const copy = COPY[status]
  const ok = status === 'connected'

  return (
    <main className="min-h-screen px-5 py-6" style={{ background: '#F8FAFB' }}>
      <div className="w-full max-w-md mx-auto py-10 f-body" data-testid={`connect-calendar-done-${status}`}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5" style={{ background: 'rgba(10,46,77,0.07)' }}>
          {ok ? <Check size={24} color={NAVY} aria-hidden /> : <CalendarX size={24} color={NAVY} aria-hidden />}
        </div>
        <h1 className="text-2xl font-bold f-display mb-3" style={{ color: NAVY }}>{copy.title}</h1>
        {copy.body.map(line => (
          <p key={line} className="text-base mb-2" style={{ color: MUTED }}>{line}</p>
        ))}
        {!ok && (
          <a href={WHATSAPP_HREF} rel="noopener noreferrer" target="_blank" className="inline-block mt-4 font-semibold underline" style={{ color: NAVY }}>
            Write to us on WhatsApp
          </a>
        )}
      </div>
    </main>
  )
}
