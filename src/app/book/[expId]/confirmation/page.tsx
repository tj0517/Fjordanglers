import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { Check } from 'lucide-react'
import { getPaymentModel } from '@/lib/payment-model'

type Props = {
  params: Promise<{ expId: string }>
  searchParams: Promise<{ bookingId?: string }>
}

export default async function BookingConfirmationPage({ params, searchParams }: Props) {
  const { expId } = await params
  const { bookingId } = await searchParams

  if (!bookingId) notFound()

  void expId

  const service = createServiceClient()

  const { data: booking } = await service
    .from('bookings')
    .select('id, booking_date, guests, total_eur, platform_fee_eur, angler_full_name, angler_email, status, experiences(title), guides(full_name, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, iban, iban_holder_name, iban_bic, iban_bank_name)')
    .eq('id', bookingId)
    .single()

  if (!booking) notFound()

  const expTitle  = (booking.experiences as unknown as { title: string } | null)?.title ?? 'Fishing trip'
  const guideData = booking.guides as unknown as {
    full_name:              string
    stripe_account_id:      string | null
    stripe_charges_enabled: boolean | null
    stripe_payouts_enabled: boolean | null
    iban:                   string | null
    iban_holder_name:       string | null
    iban_bic:               string | null
    iban_bank_name:         string | null
  } | null

  const guideName    = guideData?.full_name ?? 'your guide'
  const paymentModel = getPaymentModel({
    stripe_account_id:      guideData?.stripe_account_id      ?? null,
    stripe_charges_enabled: guideData?.stripe_charges_enabled ?? null,
    stripe_payouts_enabled: guideData?.stripe_payouts_enabled ?? null,
  })

  // For manual model: calculate split (platform fee + service fee via Stripe; remainder direct to guide)
  const subtotalEur    = Math.round((booking.total_eur / 1.05) * 100) / 100
  const serviceFeeEur  = Math.round((booking.total_eur - subtotalEur) * 100) / 100
  const platformFeeEur = booking.platform_fee_eur ?? 0
  const payNowEur      = Math.round((platformFeeEur + serviceFeeEur) * 100) / 100
  const payGuideEur    = Math.round((subtotalEur - platformFeeEur) * 100) / 100

  const hasIban = !!guideData?.iban

  const dateFormatted = new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: '#F3EDE4' }}>
      <div
        className="w-full max-w-md p-10 flex flex-col items-center text-center"
        style={{
          background: '#FDFAF7',
          borderRadius: '32px',
          border: '1px solid rgba(10,46,77,0.08)',
          boxShadow: '0 4px 32px rgba(10,46,77,0.08)',
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(74,222,128,0.12)' }}
        >
          <Check width={28} height={28} stroke="#16A34A" strokeWidth={2.5} />
        </div>

        <p className="text-[11px] uppercase tracking-[0.22em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Request sent
        </p>
        <h1 className="text-[#0A2E4D] text-2xl font-bold f-display mb-2">
          You&apos;re all set!
        </h1>
        <p className="text-sm f-body mb-8" style={{ color: 'rgba(10,46,77,0.5)' }}>
          Your request has been sent to <strong style={{ color: '#0A2E4D' }}>{guideName}</strong>. They&apos;ll confirm within 24 hours.
        </p>

        {/* ── Booking summary ─────────────────────────────────────────── */}
        <div
          className="w-full text-left mb-8"
          style={{ background: '#F3EDE4', borderRadius: '20px', overflow: 'hidden' }}
        >
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>Trip</p>
            <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{expTitle}</p>
          </div>
          <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>Date</p>
            <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{dateFormatted}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>Anglers</p>
              <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>
                {booking.guests} {booking.guests === 1 ? 'angler' : 'anglers'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>Total</p>
              <p className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>€{booking.total_eur}</p>
            </div>
          </div>
          {booking.angler_email != null && (
            <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
              <p className="text-[10px] uppercase tracking-[0.18em] f-body mb-0.5" style={{ color: 'rgba(10,46,77,0.38)' }}>Confirmation to</p>
              <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D' }}>{booking.angler_email}</p>
            </div>
          )}
        </div>

        {/* ── Payment note — varies by model ─────────────────────────── */}
        {paymentModel === 'manual' ? (
          <div className="w-full mb-8 text-left flex flex-col gap-3">
            {/* Platform fee via Stripe */}
            <div
              className="px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.14)' }}
            >
              <p className="text-xs f-body font-semibold mb-0.5" style={{ color: '#0A2E4D' }}>
                💳 Platform fee — €{payNowEur} via Stripe
              </p>
              <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                Charged securely online once the guide confirms your booking.
              </p>
            </div>

            {/* Guide fee direct */}
            <div
              className="px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}
            >
              <p className="text-xs f-body font-semibold mb-0.5" style={{ color: '#0A2E4D' }}>
                🏦 Guide&apos;s fee — €{payGuideEur} directly
              </p>
              <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                Pay the guide directly by cash or bank transfer before your trip.
              </p>
              {/* Show IBAN if guide has saved it */}
              {hasIban && (
                <div
                  className="mt-2 p-3 rounded-xl"
                  style={{ background: '#F3EDE4', border: '1px solid rgba(10,46,77,0.08)' }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.38)' }}>
                    Bank transfer details
                  </p>
                  {guideData?.iban_holder_name && (
                    <p className="text-[11px] f-body" style={{ color: '#0A2E4D' }}>
                      <span style={{ color: 'rgba(10,46,77,0.45)' }}>Name:</span>{' '}
                      {guideData.iban_holder_name}
                    </p>
                  )}
                  <p className="text-[11px] f-body" style={{ color: '#0A2E4D' }}>
                    <span style={{ color: 'rgba(10,46,77,0.45)' }}>IBAN:</span>{' '}
                    <span className="font-mono">{guideData?.iban}</span>
                  </p>
                  {guideData?.iban_bic && (
                    <p className="text-[11px] f-body" style={{ color: '#0A2E4D' }}>
                      <span style={{ color: 'rgba(10,46,77,0.45)' }}>BIC:</span>{' '}
                      {guideData.iban_bic}
                    </p>
                  )}
                  {guideData?.iban_bank_name && (
                    <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      {guideData.iban_bank_name}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className="w-full px-4 py-3 rounded-2xl mb-8 text-left"
            style={{ background: 'rgba(230,126,80,0.06)', border: '1px solid rgba(230,126,80,0.14)' }}
          >
            <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
              💳 Once the guide confirms, you&apos;ll pay a 30% deposit securely via Stripe. The remaining balance is due before the trip.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full">
          <Link
            href="/account/bookings"
            className="w-full py-3.5 rounded-2xl text-white text-sm font-semibold f-body text-center transition-all hover:brightness-110"
            style={{ background: '#0A2E4D' }}
          >
            View my bookings
          </Link>
          <Link
            href="/trips"
            className="w-full py-3.5 rounded-2xl text-sm font-semibold f-body text-center transition-all hover:bg-black/5"
            style={{ color: 'rgba(10,46,77,0.6)' }}
          >
            Browse more trips
          </Link>
        </div>
      </div>
    </div>
  )
}
