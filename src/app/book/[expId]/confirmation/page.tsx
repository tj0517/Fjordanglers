/**
 * Booking confirmation page — /book/[expId]/confirmation?session_id=cs_...
 *
 * Called after successful Stripe Checkout. Finalizes the booking (idempotent)
 * and shows the confirmation UI.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { finalizeBookingFromSession } from '@/actions/bookings'

interface Props {
  params:       Promise<{ expId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BookingConfirmationPage({ params, searchParams }: Props) {
  const { expId } = await params
  const sp        = await searchParams
  const sessionId = typeof sp.session_id === 'string' ? sp.session_id : null

  if (!sessionId) {
    redirect(`/book/${expId}`)
  }

  const result = await finalizeBookingFromSession(sessionId)

  return (
    <div style={{ background: '#F3EDE4', minHeight: '100vh' }}>
      <div className="max-w-[520px] mx-auto px-4 pt-16 pb-16">
        {result.success ? (
          <div
            className="rounded-3xl bg-white p-8 text-center"
            style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 10px rgba(10,46,77,0.06)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(22,163,74,0.1)' }}
            >
              <CheckCircle size={32} style={{ color: '#16A34A' }} />
            </div>

            <h2 className="text-2xl font-bold f-display mb-2" style={{ color: '#0A2E4D' }}>
              Booking request sent!
            </h2>

            <p className="text-sm f-body mb-1" style={{ color: 'rgba(10,46,77,0.65)' }}>
              Payment received. Your request has been sent to the guide.
            </p>
            <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.5)' }}>
              The guide will respond within 48 hours.
            </p>

            <p className="text-[11px] font-mono f-body mb-6" style={{ color: 'rgba(10,46,77,0.3)' }}>
              Ref: {result.bookingId.slice(0, 8).toUpperCase()}
            </p>

            <Link
              href="/account/bookings"
              className="block w-full py-3.5 rounded-2xl text-sm font-bold f-body text-center"
              style={{ background: '#0A2E4D', color: '#fff' }}
            >
              View my bookings →
            </Link>
          </div>
        ) : (
          <div
            className="rounded-3xl bg-white p-8 text-center"
            style={{ border: '1px solid rgba(220,38,38,0.15)', boxShadow: '0 2px 10px rgba(10,46,77,0.06)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(220,38,38,0.08)' }}
            >
              <AlertCircle size={32} style={{ color: '#DC2626' }} />
            </div>

            <h2 className="text-2xl font-bold f-display mb-2" style={{ color: '#0A2E4D' }}>
              Something went wrong
            </h2>

            <p className="text-sm f-body mb-6" style={{ color: 'rgba(10,46,77,0.6)' }}>
              {result.error}
            </p>

            <Link
              href={`/book/${expId}`}
              className="block w-full py-3.5 rounded-2xl text-sm font-bold f-body text-center"
              style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}
            >
              ← Try again
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
