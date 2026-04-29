/**
 * /inquiry-confirmed — deposit payment success landing page.
 *
 * Shown after Stripe Checkout completes for an inquiry deposit.
 * success_url: /inquiry-confirmed?inquiry_id=...
 */

import Link from 'next/link'
import { Footer } from '@/components/layout/footer'

export default async function InquiryConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const inquiryId = sp.inquiry_id ?? null

  return (
    <>
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#F8FAFB' }}>
      <div className="max-w-md w-full text-center">

        {/* Icon */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(230,126,80,0.12)', border: '2px solid rgba(230,126,80,0.3)' }}>
          <span style={{ fontSize: '36px' }}>🎣</span>
        </div>

        <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
          Booking confirmed!
        </h1>

        <p className="text-base f-body leading-relaxed mb-6" style={{ color: 'rgba(10,46,77,0.6)' }}>
          Your deposit has been received. FjordAnglers will be in touch shortly
          with full trip details and the guide&apos;s contact information.
        </p>

        <div className="p-5 rounded-2xl mb-6 text-left space-y-2"
          style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)', boxShadow: '0 2px 12px rgba(10,46,77,0.06)' }}>
          <p className="text-sm f-body" style={{ color: '#0A2E4D' }}>
            ✅ &nbsp;<strong>Deposit paid</strong> — your booking is secured
          </p>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
            📧 &nbsp;Check your email for a confirmation with trip details
          </p>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.6)' }}>
            💬 &nbsp;We&apos;ll share the guide&apos;s contact &amp; balance payment info shortly
          </p>
        </div>

        {inquiryId != null && (
          <p className="text-xs f-body mb-6" style={{ color: 'rgba(10,46,77,0.35)' }}>
            Reference: {inquiryId}
          </p>
        )}

        <Link
          href="/trips"
          className="inline-flex items-center justify-center px-8 py-3.5 rounded-2xl font-bold f-body text-sm"
          style={{ background: '#0A2E4D', color: '#fff', boxShadow: '0 4px 14px rgba(10,46,77,0.2)' }}
        >
          Browse more trips
        </Link>

      </div>
    </div>
    <Footer />
    </>
  )
}
