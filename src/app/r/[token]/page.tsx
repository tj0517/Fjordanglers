/**
 * /r/[token] — a guide's trip request (FA-M.04). Opened from WhatsApp, no sign-in: the token is
 * the credential. The GET writes nothing; the opening is recorded by `OpenedBeacon` after the
 * page has rendered in a browser (tj D1 a). Every refusal renders the same not-found page.
 * No third-party script is loaded here — Google tags, cookie banner, Meta Pixel, Clarity
 * (`THIRD_PARTY_FREE_ROUTES`).
 *
 * FA-M.07: "About the client" rows (Accommodation, Licence) and "Note from FjordAnglers" come
 * from the Trip Brief FA keeps on the inquiry card, so they show also when the client never filled
 * the form. Empty values render nothing; all text is plain React text (no HTML).
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getGuideRequestPage } from '@/lib/guide-requests/page'
import { OpenedBeacon } from './OpenedBeacon'
import { RequestPanel } from './RequestPanel'
import { datesLabel } from './format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Trip request',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

const NAVY = '#0A2E4D'
const MUTED = 'rgba(10,46,77,0.6)'

export default async function RequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await getGuideRequestPage(createServiceClient(), token)
  if (!result.ok) notFound()
  const view = result.view

  const where = [view.country, view.region].filter((v): v is string => v != null && v !== '').join(' · ')

  return (
    <main className="min-h-screen px-4 py-6" style={{ background: '#F8FAFB' }}>
      <OpenedBeacon token={token} />
      <div className="w-full max-w-md mx-auto space-y-5">
        <header>
          <p className="text-xs font-semibold tracking-widest uppercase f-body mb-1" style={{ color: MUTED }}>
            FjordAnglers · trip request
          </p>
          <h1 className="text-3xl font-bold f-display" style={{ color: NAVY }}>Can you guide this trip?</h1>
        </header>

        <dl className="rounded-2xl p-5 space-y-3" style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.1)' }}>
          <Fact label="Where" value={where === '' ? 'To be confirmed' : where} />
          <Fact label="Client's dates" value={datesLabel(view.requestedDates)} />
          <Fact label="Group" value={view.partySize == null ? 'To be confirmed' : `${view.partySize} ${view.partySize === 1 ? 'angler' : 'anglers'}`} />
        </dl>

        {view.brief != null && (
          <section className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.1)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide f-body mb-2" style={{ color: MUTED }}>
              From the client&apos;s form
            </h2>
            <ul className="space-y-1.5 text-sm f-body" style={{ color: NAVY }} data-testid="request-brief">
              {view.brief.map(line => <li key={line} className="break-words">{line}</li>)}
            </ul>
          </section>
        )}

        {(view.accommodation != null || view.licence != null) && (
          <section className="space-y-2" data-testid="request-trip-brief">
            <h2 className="text-base font-semibold f-body" style={{ color: NAVY }}>About the client</h2>
            <dl className="rounded-2xl px-4" style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.1)' }}>
              {view.accommodation != null && <BriefRow label="Accommodation" value={view.accommodation} />}
              {view.licence != null && <BriefRow label="Licence" value={view.licence} />}
            </dl>
          </section>
        )}

        {view.faNote != null && (
          <section className="space-y-2" data-testid="request-fa-note">
            <h2 className="text-base font-semibold f-body" style={{ color: NAVY }}>Note from FjordAnglers</h2>
            <p className="rounded-2xl p-4 text-sm f-body leading-relaxed whitespace-pre-line break-words"
              style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.1)', color: NAVY }}>
              {view.faNote}
            </p>
          </section>
        )}

        <RequestPanel token={token} earliestAltDate={view.earliestAltDate} initialAnswer={view.answered} />
      </div>
    </main>
  )
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b last:border-b-0" style={{ borderColor: 'rgba(10,46,77,0.08)' }}>
      <dt className="text-sm f-body flex-none" style={{ color: MUTED }}>{label}</dt>
      <dd className="text-sm f-body text-right break-words min-w-0" style={{ color: NAVY }}>{value}</dd>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide f-body" style={{ color: MUTED }}>{label}</dt>
      <dd className="text-lg font-semibold f-body" style={{ color: NAVY }}>{value}</dd>
    </div>
  )
}
