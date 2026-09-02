/**
 * /inquiry/[id]/confirmed — Stripe Checkout success_url landing page.
 *
 * Reached right after the angler pays the deposit. The Stripe webhook that
 * marks the inquiry as paid (`deposit_paid_at`) can arrive after this
 * redirect, so this page must not assume the payment has been recorded yet —
 * it renders a "processing" variant until `deposit_paid_at` is set.
 *
 * No login required — the inquiry id in the URL is not a secret, and only
 * non-sensitive fields (trip title, angler first name, deposit amount) are
 * read and shown.
 */

import { notFound } from 'next/navigation'
import { CheckCircle2, Clock } from 'lucide-react'
import { getInquiryConfirmation } from '@/actions/inquiries'

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

export default async function InquiryConfirmedPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const confirmation = await getInquiryConfirmation(id)

  if (confirmation == null) {
    notFound()
  }

  const { tripTitle, anglerName, depositAmountEur, depositPaidAt } = confirmation
  const isPaid = depositPaidAt != null

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#F8FAFB' }}
    >
      <div className="max-w-md w-full text-center py-16">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{
            background: isPaid ? 'rgba(16,185,129,0.12)' : 'rgba(230,126,80,0.12)',
          }}
        >
          {isPaid ? (
            <CheckCircle2 size={32} style={{ color: '#16a34a' }} />
          ) : (
            <Clock size={32} style={{ color: '#E67E50' }} />
          )}
        </div>

        <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
          {isPaid ? `Thank you, ${firstName(anglerName)}!` : `Almost there, ${firstName(anglerName)}!`}
        </h1>

        {isPaid ? (
          <>
            <p className="text-base f-body mb-6" style={{ color: 'rgba(10,46,77,0.6)' }}>
              Your deposit of <strong style={{ color: '#0A2E4D' }}>€{depositAmountEur.toFixed(0)}</strong> for{' '}
              <strong style={{ color: '#0A2E4D' }}>{tripTitle}</strong> has been received. We&apos;ll be in
              touch shortly with the final details.
            </p>
          </>
        ) : (
          <p className="text-base f-body mb-6" style={{ color: 'rgba(10,46,77,0.6)' }}>
            We&apos;re confirming your payment for <strong style={{ color: '#0A2E4D' }}>{tripTitle}</strong> —
            you&apos;ll receive an email shortly once it&apos;s all set. This usually takes just a moment.
          </p>
        )}

        <a
          href="mailto:contact@fjordanglers.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold f-body"
          style={{ background: '#0A2E4D', color: '#fff' }}
        >
          Contact FjordAnglers
        </a>
      </div>
    </main>
  )
}
