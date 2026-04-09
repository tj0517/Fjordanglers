'use client'

/**
 * GuideDeclineFlow — modal dialog to decline a booking request.
 * Step 1: Reason textarea (optional)
 * Step 2: Review & double-confirm before sending
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, AlertTriangle } from 'lucide-react'
import { declineBooking } from '@/actions/bookings'

interface Props {
  bookingId: string
  anglerName: string
  onClose: () => void
}

export default function GuideDeclineFlow({ bookingId, anglerName, onClose }: Props) {
  const router = useRouter()

  const [step, setStep]     = useState<'form' | 'review'>('form')
  const [reason, setReason] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await declineBooking(bookingId, { reason })
      if (!result.success) { setError(result.error); return }
      onClose()
      router.refresh()
    })
  }

  const inputStyle = {
    background: '#fff',
    border:     '1.5px solid rgba(10,46,77,0.12)',
    color:      '#0A2E4D',
    lineHeight: '1.55',
  }

  return (
    <>
      {/* Backdrop — click to cancel */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(10,46,77,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Dialog — centered on sm+, sheet from bottom on mobile */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none sm:p-6">
        <div
          className="relative w-full sm:max-w-[480px] flex flex-col pointer-events-auto rounded-t-3xl sm:rounded-3xl overflow-hidden"
          style={{
            background: '#F3EDE4',
            maxHeight:  '88vh',
            boxShadow:  '0 24px 64px rgba(10,46,77,0.25)',
          }}
        >

          {/* ── Header ── */}
          <div
            className="flex-shrink-0 flex items-center h-14 px-4"
            style={{
              background:     'rgba(243,237,228,0.96)',
              backdropFilter: 'blur(12px)',
              borderBottom:   '1px solid rgba(10,46,77,0.07)',
            }}
          >
            <button
              type="button"
              onClick={() => step === 'review' ? setStep('form') : onClose()}
              className="flex items-center gap-1.5 text-sm f-body transition-opacity hover:opacity-70"
              style={{ color: 'rgba(10,46,77,0.6)' }}
            >
              <ChevronLeft size={16} />
              {step === 'review' ? 'Back' : 'Cancel'}
            </button>
            <div className="flex-1" />
            <span className="text-sm font-semibold f-body" style={{ color: '#DC2626' }}>
              Decline Booking
            </span>
            <div className="flex-1" />
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1">
            <div className="px-4 pt-5 pb-8">

              {/* Warning banner */}
              <div
                className="rounded-2xl p-4 mb-5 flex items-start gap-3"
                style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(220,38,38,0.12)' }}
                >
                  <AlertTriangle size={16} style={{ color: '#DC2626' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold f-body" style={{ color: '#DC2626' }}>
                    Declining {anglerName}&rsquo;s booking request
                  </p>
                  <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(220,38,38,0.65)' }}>
                    The angler will receive a decline notification by email.
                  </p>
                </div>
              </div>

              {/* ── Step 1: Reason form ── */}
              {step === 'form' && (
                <div className="flex flex-col gap-4">
                  <div
                    className="rounded-2xl bg-white overflow-hidden"
                    style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.05)' }}
                  >
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.05)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        Reason for declining{' '}
                        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                      </p>
                    </div>
                    <div className="px-5 pb-5 pt-4">
                      <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={4}
                        placeholder="e.g. Those dates are fully booked. Please check my calendar for other available dates..."
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm f-body outline-none resize-none"
                        style={inputStyle}
                        onFocus={e => (e.currentTarget.style.borderColor = '#DC2626')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)')}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep('review')}
                    className="w-full py-4 rounded-2xl text-sm font-bold f-body"
                    style={{
                      background: 'rgba(220,38,38,0.08)',
                      color:      '#DC2626',
                      border:     '1.5px solid rgba(220,38,38,0.2)',
                    }}
                  >
                    Review decline →
                  </button>
                </div>
              )}

              {/* ── Step 2: Review & confirm ── */}
              {step === 'review' && (
                <div className="flex flex-col gap-4">
                  <div
                    className="rounded-2xl bg-white p-5"
                    style={{ border: '1px solid rgba(10,46,77,0.07)', boxShadow: '0 2px 8px rgba(10,46,77,0.05)' }}
                  >
                    <p className="text-base font-bold f-display mb-1" style={{ color: '#0A2E4D' }}>
                      Are you sure?
                    </p>
                    <p className="text-sm f-body mb-4" style={{ color: 'rgba(10,46,77,0.55)' }}>
                      This action cannot be undone. {anglerName} will be notified.
                    </p>

                    {reason.trim() !== '' && (
                      <div className="pt-3" style={{ borderTop: '1px solid rgba(10,46,77,0.06)' }}>
                        <p className="text-xs font-medium f-body mb-1.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                          Your reason
                        </p>
                        <p className="text-sm f-body leading-relaxed" style={{ color: '#0A2E4D' }}>
                          &ldquo;{reason}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>

                  {error != null && (
                    <div className="rounded-xl px-4 py-3 text-sm f-body"
                      style={{ background: 'rgba(220,38,38,0.07)', color: '#DC2626' }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleSubmit}
                    className="w-full py-4 rounded-2xl text-sm font-bold f-body flex items-center justify-center gap-2"
                    style={{
                      background: '#DC2626',
                      color:      '#fff',
                      boxShadow:  '0 4px 14px rgba(220,38,38,0.25)',
                      opacity:    isPending ? 0.7 : 1,
                    }}
                  >
                    {isPending && <Loader2 size={16} className="animate-spin" />}
                    {isPending ? 'Declining...' : 'Yes, decline booking'}
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  )
}
