import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { CreditCard, Receipt } from 'lucide-react'

type BookingStatus = Database['public']['Enums']['booking_status']

type PaymentBooking = {
  id: string
  booking_date: string
  status: BookingStatus
  source: string | null
  deposit_eur: number | null
  total_eur: number | null
  balance_paid_at: string | null
  balance_payment_method: string | null
  stripe_checkout_id: string | null
  stripe_payment_intent_id: string | null
  balance_stripe_payment_intent_id: string | null
  confirmed_at: string | null
  experience_title: string | null
  guide_name: string | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnglerPaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/account/payments')

  const { data: raw } = await supabase
    .from('bookings')
    .select(
      'id, booking_date, status, source, deposit_eur, total_eur, balance_paid_at, balance_payment_method, stripe_checkout_id, stripe_payment_intent_id, balance_stripe_payment_intent_id, confirmed_at, experiences(title), guides(full_name)',
    )
    .eq('angler_id', user.id)
    .order('booking_date', { ascending: false })

  const bookings: PaymentBooking[] = (raw ?? []).map(b => ({
    id:                               b.id,
    booking_date:                     b.booking_date,
    status:                           b.status,
    source:                           b.source,
    deposit_eur:                      b.deposit_eur,
    total_eur:                        b.total_eur,
    balance_paid_at:                  b.balance_paid_at,
    balance_payment_method:           b.balance_payment_method,
    stripe_checkout_id:               b.stripe_checkout_id,
    stripe_payment_intent_id:         b.stripe_payment_intent_id,
    balance_stripe_payment_intent_id: b.balance_stripe_payment_intent_id,
    confirmed_at:                     b.confirmed_at,
    experience_title:                 (b.experiences as unknown as { title: string } | null)?.title ?? null,
    guide_name:                       (b.guides as unknown as { full_name: string } | null)?.full_name ?? null,
  }))

  // ── Pending charges ──────────────────────────────────────────────────────────
  const pendingCharges = bookings.filter(b => {
    // 'accepted'      = direct booking guide accepted, deposit due
    // 'offer_accepted' = inquiry offer angler accepted, full/fee payment due
    if ((b.status === 'accepted' || b.status === 'offer_accepted') && b.stripe_checkout_id != null) return true
    if (
      b.status === 'confirmed' &&
      b.balance_payment_method === 'stripe' &&
      b.balance_paid_at == null
    ) return true
    return false
  })

  // ── Payment receipts ─────────────────────────────────────────────────────────
  type ReceiptEntry = {
    key: string
    bookingId: string
    title: string
    guideName: string | null
    bookingDate: string
    label: string
    date: string
    amountEur: number
    ref: string
  }

  const receipts: ReceiptEntry[] = []
  for (const b of bookings) {
    const title    = b.experience_title ?? 'Custom trip'
    const shortRef = b.id.slice(-8).toUpperCase()

    if (b.stripe_payment_intent_id != null) {
      receipts.push({
        key:         `${b.id}-deposit`,
        bookingId:   b.id,
        title,
        guideName:   b.guide_name,
        bookingDate: b.booking_date,
        label:       'Deposit paid',
        date:        b.confirmed_at ?? b.booking_date,
        amountEur:   b.deposit_eur ?? Math.round((b.total_eur ?? 0) * 0.4),
        ref:         shortRef,
      })
    }
    if (b.balance_stripe_payment_intent_id != null && b.balance_paid_at != null) {
      const depositEur = b.deposit_eur ?? Math.round((b.total_eur ?? 0) * 0.4)
      receipts.push({
        key:         `${b.id}-balance`,
        bookingId:   b.id,
        title,
        guideName:   b.guide_name,
        bookingDate: b.booking_date,
        label:       'Balance paid',
        date:        b.balance_paid_at,
        amountEur:   Math.round((b.total_eur ?? 0) - depositEur),
        ref:         shortRef,
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[900px]">
      <div className="mb-8">
        <h1 className="text-[#0A2E4D] text-3xl font-bold f-display">
          My <span style={{ fontStyle: 'italic' }}>Payments</span>
        </h1>
        <p className="text-[#0A2E4D]/45 text-sm mt-1 f-body">
          Pending charges and payment history.
        </p>
      </div>

      {/* ── Pending charges ──────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2
          className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
          style={{ color: 'rgba(10,46,77,0.4)' }}
        >
          Pending charges
        </h2>

        {pendingCharges.length === 0 ? (
          <div
            className="px-6 py-8 text-center"
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.07)',
            }}
          >
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>No pending payments.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingCharges.map(b => {
              const isDepositPending  = b.status === 'accepted' || b.status === 'offer_accepted'
              const isBalancePending  = b.status === 'confirmed' && b.balance_paid_at == null
              const depositEur        = b.deposit_eur ?? Math.round((b.total_eur ?? 0) * 0.4)
              const balanceEur        = Math.round((b.total_eur ?? 0) - depositEur)
              const amountDue         = isDepositPending ? depositEur : balanceEur
              const actionLabel       = isDepositPending ? 'Pay now' : 'Pay balance'
              const title             = b.experience_title ?? 'Custom trip'
              // offer_accepted inquiry bookings redirect from trips/[id] → always use bookings/[id]
              const href = `/account/bookings/${b.id}`
              const dateFormatted     = new Date(`${b.booking_date}T12:00:00`).toLocaleDateString(
                'en-GB', { day: 'numeric', month: 'short', year: 'numeric' },
              )

              return (
                <div
                  key={b.id}
                  className="px-5 py-4 flex items-center gap-4 justify-between"
                  style={{
                    background:   '#FDFAF7',
                    borderRadius: '20px',
                    border:       '1px solid rgba(230,126,80,0.2)',
                    boxShadow:    '0 2px 12px rgba(230,126,80,0.06)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(230,126,80,0.1)' }}
                    >
                      <CreditCard width={16} height={16} stroke="#E67E50" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">{title}</p>
                      <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        {b.guide_name ?? 'Guide'} · {dateFormatted}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[#0A2E4D] text-base font-bold f-display">€{amountDue}</p>
                      <p className="text-[10px] f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>due now</p>
                    </div>
                    <Link
                      href={href}
                      className="px-4 py-2 rounded-xl text-sm font-semibold f-body transition-opacity hover:opacity-80"
                      style={{ background: '#E67E50', color: '#fff' }}
                    >
                      {actionLabel} →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Payment receipts ─────────────────────────────────────────────── */}
      <section>
        <h2
          className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
          style={{ color: 'rgba(10,46,77,0.4)' }}
        >
          Payment history
        </h2>

        {receipts.length === 0 ? (
          <div
            className="px-6 py-8 text-center"
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.07)',
            }}
          >
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>No payments yet.</p>
          </div>
        ) : (
          <div
            style={{
              background:   '#FDFAF7',
              borderRadius: '20px',
              border:       '1px solid rgba(10,46,77,0.07)',
              overflow:     'hidden',
            }}
          >
            {receipts.map((entry, i) => {
              const dateFormatted = new Date(entry.date).toLocaleDateString(
                'en-GB', { day: 'numeric', month: 'short', year: 'numeric' },
              )
              const href = entry.bookingId ? `/account/bookings/${entry.bookingId}` : null

              return (
                <div
                  key={entry.key}
                  className="px-6 py-4 flex items-center gap-4 justify-between"
                  style={{
                    borderBottom: i < receipts.length - 1 ? '1px solid rgba(10,46,77,0.06)' : undefined,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(22,163,74,0.09)' }}
                    >
                      <Receipt width={14} height={14} stroke="#16A34A" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#0A2E4D] text-sm font-semibold f-body truncate">{entry.title}</p>
                      <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        {entry.label} · {dateFormatted}
                        <span
                          className="ml-2 font-mono text-[10px]"
                          style={{ color: 'rgba(10,46,77,0.3)' }}
                        >
                          #{entry.ref}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-[#0A2E4D] text-sm font-bold f-display">€{entry.amountEur}</p>
                    {href && (
                      <Link
                        href={href}
                        className="text-xs f-body transition-opacity hover:opacity-70"
                        style={{ color: 'rgba(10,46,77,0.4)' }}
                      >
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
