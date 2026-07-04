/**
 * /offers/[token] — Public offer page for the angler.
 *
 * Accessed via magic link from the offer email.
 * No login required — the token IS the authentication.
 */

import Image from 'next/image'
import Link from 'next/link'
import { getOfferByToken } from '@/actions/inquiries'
import { OfferPayButton } from './OfferPayButton'
import { OfferLocationMap } from '@/components/offer/OfferLocationMap'
import { currencyForCountry, fetchEurRate, fmtConverted } from '@/lib/fx'
import { CheckCircle2, Calendar, Users, Shield, ChevronRight } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDates(dates: string[]): string {
  if (dates.length === 0) return 'Dates to be confirmed'
  if (dates.length === 1) return fmtDate(dates[0])
  return dates.map(fmtDate).join(', ')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OfferPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const offer = await getOfferByToken(token)

  if (offer == null) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#F8FAFB' }}>
        <div className="max-w-md w-full text-center py-16">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            <span className="text-2xl">🔗</span>
          </div>
          <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
            Offer not found
          </h1>
          <p className="text-base f-body mb-6" style={{ color: 'rgba(10,46,77,0.6)' }}>
            This offer link has expired or is no longer valid.
            Please contact us and we&apos;ll send you a fresh one.
          </p>
          <a href="mailto:contact@fjordanglers.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold f-body"
            style={{ background: '#E67E50', color: '#fff' }}>
            Contact FjordAnglers
          </a>
        </div>
      </main>
    )
  }

  if (offer.status === 'deposit_paid' || offer.status === 'completed') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#F8FAFB' }}>
        <div className="max-w-md w-full text-center py-16">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(16,185,129,0.12)' }}>
            <CheckCircle2 size={32} style={{ color: '#16a34a' }} />
          </div>
          <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
            Booking confirmed!
          </h1>
          <p className="text-base f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
            Your deposit has been received. We&apos;ll be in touch with final details.
          </p>
        </div>
      </main>
    )
  }

  if (offer.status === 'in_negotiation' || offer.status === 'deposit_sent') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#F8FAFB' }}>
        <div className="max-w-md w-full text-center py-16">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
            🎣
          </div>
          <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
            Offer accepted!
          </h1>
          <p className="text-base f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
            We&apos;ve received your response. FjordAnglers will be in touch shortly to confirm the details.
          </p>
        </div>
      </main>
    )
  }

  if (offer.status === 'lost' || offer.status === 'cancelled') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#F8FAFB' }}>
        <div className="max-w-md w-full text-center py-16">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(10,46,77,0.07)' }}>
            <span className="text-2xl">👋</span>
          </div>
          <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
            Offer declined
          </h1>
          <p className="text-base f-body mb-6" style={{ color: 'rgba(10,46,77,0.6)' }}>
            Thanks for letting us know. If you change your mind or want to explore other trips, we&apos;re here.
          </p>
          <a href="mailto:contact@fjordanglers.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold f-body"
            style={{ background: '#0A2E4D', color: '#fff' }}>
            Contact FjordAnglers
          </a>
        </div>
      </main>
    )
  }

  const hasQuestions = offer.questions.length > 0
  const balanceEur   = offer.offerTotalEur - offer.offerDepositEur
  const hasPhotos    = offer.photos.length > 0

  // Currency conversion hint (display only — no Stripe payment, for reference)
  const localCurrency = currencyForCountry(offer.anglerCountry)
  const localRate     = localCurrency != null ? await fetchEurRate(localCurrency) : null

  return (
    <main style={{ background: '#F8FAFB', minHeight: '100vh' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ background: '#0A2E4D' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link href="/" aria-label="FjordAnglers">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://fjordanglers.com/brand/white-logo.png"
              alt="FjordAnglers"
              width={140}
              height={32}
              style={{ height: '32px', width: 'auto' }}
            />
          </Link>
          <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Personalised Offer
          </span>
        </div>
      </div>

      {/* ── Hero / Intro ─────────────────────────────────────────────────── */}
      <div style={{ background: '#0A2E4D', paddingBottom: '64px' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-0">
          <p className="text-sm font-semibold f-body mb-2" style={{ color: '#E67E50' }}>
            Hi {offer.anglerName} 👋
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold f-display mb-4" style={{ color: '#FFFFFF', lineHeight: '1.15' }}>
            Your personalised offer<br />for <span style={{ color: '#E67E50' }}>{offer.tripTitle}</span>
          </h1>
          <p className="text-base f-body" style={{ color: 'rgba(255,255,255,0.65)', maxWidth: '520px' }}>
            We put this together especially for you. Take a look at the full trip plan,
            what&apos;s included, and confirm your spot below.
          </p>
        </div>
      </div>

      {/* ── Photo gallery (between hero and content) ──────────────────────── */}
      {hasPhotos && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6"
          style={{ marginTop: '-20px', marginBottom: '-20px', position: 'relative', zIndex: 1 }}>
          <div
            className="overflow-hidden rounded-2xl"
            style={{ border: '2px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 40px rgba(10,46,77,0.2)' }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: offer.photos.length === 1 ? '1fr' : '1fr 1fr',
                gap: '2px',
              }}
            >
              {offer.photos.slice(0, 6).map((url, i) => {
                const isHero   = offer.photos.length >= 3 && i === 0
                const showMore = i === 5 && offer.photos.length > 6
                return (
                  <div
                    key={url}
                    style={{
                      gridColumn:  isHero ? '1 / -1' : undefined,
                      aspectRatio: isHero
                        ? '21/8'
                        : offer.photos.length === 1 ? '16/7'
                        : '4/3',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <Image
                      src={url}
                      alt={`Trip photo ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 672px"
                    />
                    {showMore && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'rgba(10,46,77,0.55)' }}
                      >
                        <span className="text-white font-bold text-2xl f-display">
                          +{offer.photos.length - 6}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6"
        style={{ marginTop: hasPhotos ? '32px' : '-40px', paddingBottom: '60px' }}>

        {/* ── Offer CTA card ──────────────────────────────────────────────── */}
        <div className="p-6 rounded-2xl mb-6"
          style={{
            background:  '#FFFFFF',
            border:      '1px solid rgba(10,46,77,0.08)',
            boxShadow:   '0 8px 40px rgba(10,46,77,0.12)',
          }}>

          {/* Price breakdown */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
            <div className="text-center">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.06em] sm:tracking-[0.1em] f-body mb-1"
                style={{ color: 'rgba(10,46,77,0.4)' }}>Total</p>
              <p className="text-xl sm:text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                €{offer.offerTotalEur.toFixed(0)}
              </p>
            </div>
            <div className="text-center"
              style={{ borderLeft: '1px solid rgba(10,46,77,0.06)', borderRight: '1px solid rgba(10,46,77,0.06)' }}>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.06em] sm:tracking-[0.1em] f-body mb-1"
                style={{ color: 'rgba(10,46,77,0.4)' }}>Deposit</p>
              <p className="text-xl sm:text-2xl font-bold f-display" style={{ color: '#E67E50' }}>
                €{offer.offerDepositEur.toFixed(0)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.06em] sm:tracking-[0.1em] f-body mb-1"
                style={{ color: 'rgba(10,46,77,0.4)' }}>To guide</p>
              <p className="text-xl sm:text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                €{balanceEur.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Local currency hint */}
          {localRate != null && localCurrency != null && (
            <p className="text-center text-[11px] f-body mb-4 -mt-2"
              style={{ color: 'rgba(10,46,77,0.38)' }}>
              {fmtConverted(offer.offerTotalEur, localRate, localCurrency)} total
              &nbsp;·&nbsp;
              {fmtConverted(offer.offerDepositEur, localRate, localCurrency)} deposit
              &nbsp;·&nbsp;today&apos;s ECB rate
            </p>
          )}

          {/* Refundable notice */}
          {offer.refundReason != null && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-4"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Shield size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p className="text-xs font-bold f-body mb-0.5" style={{ color: '#065F46' }}>
                  Refundable deposit
                </p>
                <p className="text-sm f-body" style={{ color: '#047857' }}>
                  {offer.refundReason}
                </p>
              </div>
            </div>
          )}

          {/* Trip meta */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-5 text-sm f-body"
            style={{ color: 'rgba(10,46,77,0.6)' }}>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} /> {fmtDates(offer.requestedDates)}
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} /> {offer.partySize} {offer.partySize === 1 ? 'angler' : 'anglers'}
            </span>
            <span className="flex items-center gap-1.5">
              {offer.guideName}
            </span>
          </div>

          {/* CTA */}
          <OfferPayButton
            token={token}
            hasQuestions={hasQuestions}
            questions={offer.questions}
            depositEur={offer.offerDepositEur}
          />
        </div>

        {/* ── Guide card ─────────────────────────────────────────────────── */}
        <div className="p-5 rounded-2xl mb-6 flex items-start gap-4"
          style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}>
          {offer.guidePhotoUrl != null ? (
            <Image
              src={offer.guidePhotoUrl}
              alt={offer.guideName}
              width={64}
              height={64}
              className="rounded-full object-cover flex-shrink-0"
              style={{ width: '64px', height: '64px' }}
            />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(10,46,77,0.08)' }}>
              <span className="text-xl">🎣</span>
            </div>
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] f-body mb-1"
              style={{ color: '#E67E50' }}>Your guide</p>
            <p className="text-lg font-bold f-display" style={{ color: '#0A2E4D' }}>
              {offer.guideName}
            </p>
            {offer.guideBio != null && offer.guideBio.trim() !== '' && (
              <p className="text-sm f-body mt-1.5 leading-relaxed"
                style={{ color: 'rgba(10,46,77,0.65)' }}>
                {offer.guideBio}
              </p>
            )}
          </div>
        </div>

        {/* ── Location ───────────────────────────────────────────────────── */}
        {((offer.location != null && offer.location.trim() !== '') || offer.locationLat != null) && (
          <Section title="Where It Happens" icon="📍">
            {offer.location != null && offer.location.trim() !== '' && (
              <p className="text-sm f-body leading-relaxed whitespace-pre-wrap mb-0"
                style={{ color: '#374151' }}>
                {offer.location}
              </p>
            )}
            {offer.locationLat != null && offer.locationLng != null && (
              <OfferLocationMap
                lat={offer.locationLat}
                lng={offer.locationLng}
                zoom={offer.locationZoom}
                geojson={offer.locationGeoJson}
              />
            )}
          </Section>
        )}

        {/* ── Schedule / Trip plan ────────────────────────────────────────── */}
        {offer.schedule.length > 0 ? (
          <Section title="Trip Schedule" icon="🗓️">
            <ol className="relative" style={{ paddingLeft: '28px' }}>
              <div
                className="absolute left-0 top-2 bottom-2"
                style={{
                  left: '9px',
                  width: '2px',
                  background: 'linear-gradient(to bottom, #E67E50, rgba(230,126,80,0.15))',
                  borderRadius: '999px',
                }}
              />
              {offer.schedule.map((entry, i) => (
                <li key={entry.id ?? i} className="relative mb-6 last:mb-0">
                  <div
                    className="absolute flex items-center justify-center"
                    style={{
                      left: '-28px', top: '2px',
                      width: '18px', height: '18px',
                      borderRadius: '50%',
                      background: '#E67E50',
                      border: '2.5px solid #fff',
                      boxShadow: '0 0 0 2px rgba(230,126,80,0.2)',
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    {entry.label && (
                      <span
                        className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] f-body px-2 py-0.5 rounded-full mb-1.5"
                        style={{ background: 'rgba(230,126,80,0.12)', color: '#C4623A' }}
                      >
                        {entry.label}
                      </span>
                    )}
                    {entry.title && (
                      <p className="text-sm font-semibold f-body mb-1" style={{ color: '#0A2E4D' }}>
                        {entry.title}
                      </p>
                    )}
                    {entry.description && (
                      <p className="text-sm f-body leading-relaxed" style={{ color: '#374151' }}>
                        {entry.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        ) : offer.tripPlan != null && offer.tripPlan.trim() !== '' ? (
          <Section title="Trip Plan" icon="🗓️">
            <div className="text-sm f-body leading-relaxed whitespace-pre-wrap"
              style={{ color: '#374151' }}>
              {offer.tripPlan}
            </div>
          </Section>
        ) : null}

        {/* ── What's included ────────────────────────────────────────────── */}
        {offer.inclusions.length > 0 && (
          <Section
            title={`What's Included${offer.offerTotalEur > 0 ? ` — €${offer.offerTotalEur.toFixed(0)}` : ''}`}
            icon="✅"
          >
            <ul className="space-y-2.5">
              {offer.inclusions.map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span className="text-sm f-body" style={{ color: '#374151' }}>{item}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── What to bring ──────────────────────────────────────────────── */}
        {offer.whatToBring.length > 0 && (
          <Section title="What to Bring" icon="🎒">
            <ul
              className="grid gap-x-6 gap-y-2.5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
            >
              {offer.whatToBring.map((item, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#E67E50' }} />
                  <span className="text-sm f-body" style={{ color: '#374151' }}>{item}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Fishing licence ─────────────────────────────────────────────── */}
        {((offer.licenseHeading != null && offer.licenseHeading.trim() !== '') ||
          (offer.licenseInfo   != null && offer.licenseInfo.trim()   !== '')) && (
          <Section title="Fishing Licence" icon="📋">
            {offer.licenseHeading != null && offer.licenseHeading.trim() !== '' && (
              <h3 className="text-sm font-bold f-body mb-2" style={{ color: '#0A2E4D' }}>
                {offer.licenseHeading}
              </h3>
            )}
            {offer.licenseInfo != null && offer.licenseInfo.trim() !== '' && (
              <div className="text-sm f-body leading-relaxed whitespace-pre-wrap"
                style={{ color: '#374151' }}>
                {offer.licenseInfo}
              </div>
            )}
          </Section>
        )}

        {/* ── FA notes ───────────────────────────────────────────────────── */}
        {offer.notes != null && offer.notes.trim() !== '' && (
          <Section title="Note from FjordAnglers" icon="💬">
            <p className="text-sm f-body leading-relaxed" style={{ color: '#374151', fontStyle: 'italic' }}>
              &ldquo;{offer.notes}&rdquo;
            </p>
          </Section>
        )}

        {/* ── Questions ──────────────────────────────────────────────────── */}
        {hasQuestions && (
          <Section title="A Few Questions" icon="❓">
            <p className="text-sm f-body mb-4" style={{ color: 'rgba(10,46,77,0.6)' }}>
              Please answer the questions below before accepting your offer.
              Your answers help us prepare the best possible experience for you.
            </p>
            <OfferPayButton
              token={token}
              hasQuestions={true}
              questions={offer.questions}
              depositEur={offer.offerDepositEur}
              showOnlyForm
            />
          </Section>
        )}

        {/* ── Bottom contact ──────────────────────────────────────────────── */}
        <div className="py-8 text-center">
          <p className="text-sm f-body mb-3" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Questions about this offer? Reply to our email or contact us.
          </p>
          <a href="mailto:contact@fjordanglers.com"
            className="inline-flex items-center gap-1.5 text-sm font-semibold f-body"
            style={{ color: '#E67E50' }}>
            contact@fjordanglers.com <ChevronRight size={14} />
          </a>
        </div>

        {/* Footer */}
        <div className="pb-8 text-center">
          <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
            FjordAnglers · Connecting guides &amp; anglers across Scandinavia
          </p>
        </div>

      </div>
    </main>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <div className="p-6 rounded-2xl mb-6"
      style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <h2 className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}
