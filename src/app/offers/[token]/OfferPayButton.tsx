'use client'

/**
 * OfferPayButton — handles the angler's Q&A form + deposit payment.
 *
 * If the offer has questions: shows a form. On submit, saves answers and
 * redirects to Stripe Checkout.
 *
 * If no questions: shows a single "Pay Deposit" button directly.
 *
 * showOnlyForm prop: when true, only renders the form (used in the questions
 * section lower on the page) so the sticky CTA at the top stays clean.
 */

import { useState, useTransition } from 'react'
import { submitOfferAnswers } from '@/actions/inquiries'
import type { OfferQuestion, OfferAnswer } from '@/actions/inquiries'
import { Loader2 } from 'lucide-react'

interface Props {
  token: string
  hasQuestions: boolean
  questions: OfferQuestion[]
  depositEur: number
  showOnlyForm?: boolean
}

export function OfferPayButton({
  token,
  hasQuestions,
  questions,
  depositEur,
  showOnlyForm = false,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => Object.fromEntries(questions.map(q => [q.id, '']))
  )
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  function updateAnswer(id: string, val: string) {
    setAnswers(prev => ({ ...prev, [id]: val }))
  }

  function handlePay() {
    startTransition(async () => {
      setError(null)

      const builtAnswers: OfferAnswer[] = questions.map(q => ({
        id:       q.id,
        question: q.question,
        answer:   answers[q.id] ?? '',
      }))

      const res = await submitOfferAnswers(token, builtAnswers)

      if (res.success) {
        window.location.href = res.checkoutUrl
      } else {
        setError(res.error)
      }
    })
  }

  // ── No questions: just a button ─────────────────────────────────────────────
  if (!hasQuestions) {
    if (showOnlyForm) return null

    return (
      <div>
        <button
          type="button"
          onClick={handlePay}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold f-body transition-all"
          style={{
            background: isPending ? 'rgba(230,126,80,0.6)' : '#E67E50',
            color:      '#fff',
            cursor:     isPending ? 'not-allowed' : 'pointer',
            boxShadow:  isPending ? 'none' : '0 4px 20px rgba(230,126,80,0.4)',
          }}
        >
          {isPending
            ? <><Loader2 size={16} className="animate-spin" /> Preparing payment…</>
            : `Pay €${depositEur.toFixed(2)} deposit to secure your spot →`}
        </button>
        {error != null && (
          <p className="text-sm f-body text-center mt-3" style={{ color: '#991B1B' }}>
            {error}
          </p>
        )}
        <p className="text-xs f-body text-center mt-2.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
          Secure payment via Stripe · Refundable per the terms above
        </p>
      </div>
    )
  }

  // ── Has questions ───────────────────────────────────────────────────────────

  // Top of page: just show the CTA that expands the form below
  if (!showOnlyForm && !showForm) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setShowForm(true)
            document.getElementById('offer-questions')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold f-body transition-all"
          style={{
            background: '#E67E50',
            color:      '#fff',
            boxShadow:  '0 4px 20px rgba(230,126,80,0.4)',
          }}
        >
          Answer questions &amp; pay €{depositEur.toFixed(2)} deposit →
        </button>
        <p className="text-xs f-body text-center mt-2.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
          {questions.length} question{questions.length > 1 ? 's' : ''} · then secure payment via Stripe
        </p>
      </div>
    )
  }

  // Form: show all questions + submit
  return (
    <div id="offer-questions" className="space-y-4">
      {questions.map((q, i) => (
        <div key={q.id}>
          <label className="text-sm font-semibold f-body block mb-1.5" style={{ color: '#0A2E4D' }}>
            {i + 1}. {q.question}
          </label>
          <textarea
            value={answers[q.id] ?? ''}
            onChange={e => updateAnswer(q.id, e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm f-body resize-none"
            style={{
              background: 'rgba(10,46,77,0.03)',
              border:     '1.5px solid rgba(10,46,77,0.12)',
              color:      '#0A2E4D',
              outline:    'none',
            }}
            placeholder="Your answer…"
          />
        </div>
      ))}

      {error != null && (
        <div className="px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm f-body" style={{ color: '#991B1B' }}>{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold f-body transition-all"
        style={{
          background: isPending ? 'rgba(230,126,80,0.6)' : '#E67E50',
          color:      '#fff',
          cursor:     isPending ? 'not-allowed' : 'pointer',
          boxShadow:  isPending ? 'none' : '0 4px 20px rgba(230,126,80,0.4)',
        }}
      >
        {isPending
          ? <><Loader2 size={16} className="animate-spin" /> Preparing payment…</>
          : `Submit answers &amp; pay €${depositEur.toFixed(2)} deposit →`}
      </button>

      <p className="text-xs f-body text-center" style={{ color: 'rgba(10,46,77,0.4)' }}>
        Secure payment via Stripe · Your answers are sent to FjordAnglers
      </p>
    </div>
  )
}
