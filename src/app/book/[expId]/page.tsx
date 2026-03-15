import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getExperience } from '@/lib/supabase/queries'
import BookingCheckoutForm from './BookingCheckoutForm'

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_FEE_RATE = 0.07

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ expId: string }>
  searchParams: Promise<{ dates?: string; guests?: string }>
}

export default async function BookPage({ params, searchParams }: Props) {
  const { expId } = await params
  const sp = await searchParams

  const rawDates = sp.dates ?? ''
  const dates = rawDates
    .split(',')
    .map(d => d.trim())
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))

  if (dates.length === 0) {
    redirect(`/experiences/${expId}`)
  }

  const guests = Math.max(1, parseInt(sp.guests ?? '1', 10))

  // ── Fetch experience ──────────────────────────────────────────────────────
  const experience = await getExperience(expId)
  if (!experience) notFound()

  // ── Auth — pre-fill if logged in ──────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/book/${expId}?dates=${rawDates}&guests=${guests}`)
  }

  let defaultName = ''
  let defaultEmail = user.email ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  if (profile?.full_name) defaultName = profile.full_name

  // ── Price calculation (mirrors BookingWidget logic) ────────────────────────
  const pricePerPerson = experience.price_per_person_eur ?? 0
  const subtotal = Math.round(pricePerPerson * guests * dates.length * 100) / 100
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100
  const totalEur = Math.round((subtotal + serviceFee) * 100) / 100
  const depositEur = Math.round(totalEur * 0.3 * 100) / 100
  const balanceDue = Math.round((totalEur - depositEur) * 100) / 100

  // ── Cover image ───────────────────────────────────────────────────────────
  const coverImage = experience.images.find(img => img.is_cover) ?? experience.images[0]

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ── Nav bar ──────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-6 py-4"
        style={{
          background: 'rgba(243,237,228,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(10,46,77,0.06)',
        }}
      >
        <Link href={`/experiences/${expId}`}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="#0A2E4D"
            strokeWidth="1.6"
          >
            <polyline points="12,5 7,10 12,15" />
          </svg>
        </Link>
        <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
          Request to Book
        </p>
        <div className="w-5" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 grid lg:grid-cols-2 gap-10">

        {/* ── LEFT: Experience summary ──────────────────────────────────────── */}
        <div className="flex flex-col gap-6">

          {/* Experience card */}
          <div
            className="overflow-hidden"
            style={{
              background: '#FDFAF7',
              borderRadius: '24px',
              border: '1px solid rgba(10,46,77,0.08)',
              boxShadow: '0 2px 16px rgba(10,46,77,0.06)',
            }}
          >
            {/* Photo */}
            {coverImage && (
              <div className="relative h-48 overflow-hidden">
                <Image
                  src={coverImage.url}
                  alt={experience.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            <div className="p-6">
              <p className="text-xs f-body mb-1" style={{ color: 'rgba(10,46,77,0.45)' }}>
                {experience.guide.full_name}
              </p>
              <h1 className="text-[#0A2E4D] text-xl font-bold f-display leading-snug mb-1">
                {experience.title}
              </h1>
              {experience.location_city != null && (
                <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  📍 {experience.location_city}, {experience.location_country}
                </p>
              )}
            </div>
          </div>

          {/* Price breakdown */}
          <div
            className="p-6"
            style={{
              background: '#FDFAF7',
              borderRadius: '24px',
              border: '1px solid rgba(10,46,77,0.08)',
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
              style={{ color: 'rgba(10,46,77,0.4)' }}
            >
              Price Breakdown
            </p>

            <div className="flex flex-col gap-2.5">
              <PriceLine
                label={`€${pricePerPerson}/pp × ${guests} ${guests === 1 ? 'angler' : 'anglers'} × ${dates.length} ${dates.length === 1 ? 'day' : 'days'}`}
                value={`€${subtotal}`}
              />
              <PriceLine label="Service fee (7%)" value={`€${serviceFee}`} muted />

              <div
                className="my-1"
                style={{ height: '1px', background: 'rgba(10,46,77,0.08)' }}
              />

              <PriceLine label="Total" value={`€${totalEur}`} bold />

              <div
                className="my-1"
                style={{ height: '1px', background: 'rgba(10,46,77,0.08)' }}
              />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold f-display" style={{ color: '#E67E50' }}>
                    Due today (30%)
                  </p>
                  <p
                    className="text-[11px] f-body mt-0.5"
                    style={{ color: 'rgba(10,46,77,0.4)' }}
                  >
                    Deposit — refundable if guide declines
                  </p>
                </div>
                <p className="text-2xl font-bold f-display" style={{ color: '#E67E50' }}>
                  €{depositEur}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                    Balance (70%)
                  </p>
                  <p
                    className="text-[11px] f-body mt-0.5"
                    style={{ color: 'rgba(10,46,77,0.35)' }}
                  >
                    Due after guide confirmation
                  </p>
                </div>
                <p className="text-lg font-bold f-display" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  €{balanceDue}
                </p>
              </div>
            </div>
          </div>

          {/* Trust block */}
          <div
            className="p-5"
            style={{
              background: 'rgba(230,126,80,0.06)',
              borderRadius: '20px',
              border: '1px solid rgba(230,126,80,0.14)',
            }}
          >
            {[
              { icon: '🛡️', text: 'No additional charge until guide confirms' },
              { icon: '⏰', text: 'Guide responds within 24 hours' },
              { icon: '🔒', text: 'Secure payment via Stripe — no card stored' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 mb-2.5 last:mb-0">
                <span className="text-base leading-none">{item.icon}</span>
                <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Angler contact form ──────────────────────────────────────── */}
        <div>
          <div
            className="p-8"
            style={{
              background: '#FDFAF7',
              borderRadius: '28px',
              border: '1px solid rgba(10,46,77,0.08)',
              boxShadow: '0 4px 24px rgba(10,46,77,0.07)',
            }}
          >
            <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-2">
              Your Details
            </h2>
            <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.5)' }}>
              {guests} {guests === 1 ? 'angler' : 'anglers'} ·{' '}
              {dates.length} {dates.length === 1 ? 'date' : 'dates'} selected
            </p>

            <BookingCheckoutForm
              expId={expId}
              dates={dates}
              guests={guests}
              defaultName={defaultName}
              defaultEmail={defaultEmail}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function PriceLine({
  label,
  value,
  bold = false,
  muted = false,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-sm f-body"
        style={{ color: muted ? 'rgba(10,46,77,0.38)' : 'rgba(10,46,77,0.6)' }}
      >
        {label}
      </span>
      <span
        className="text-sm f-body"
        style={{
          color: bold ? '#0A2E4D' : muted ? 'rgba(10,46,77,0.38)' : 'rgba(10,46,77,0.7)',
          fontWeight: bold ? 700 : 500,
        }}
      >
        {value}
      </span>
    </div>
  )
}
