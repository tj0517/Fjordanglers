'use client'

/**
 * OfferResponseButtons — angler responds to the offer.
 *
 * If the offer has questions: shows a Q&A form first.
 * Actions: "Accept this offer" or "Decline" (optional note).
 * No Stripe payment — acceptance triggers FA to follow up manually.
 */

import { useState, useTransition } from 'react'
import { acceptOffer, declineOffer } from '@/actions/inquiries'
import type { OfferQuestion, OfferAnswer } from '@/actions/inquiries'
import { Loader2, ChevronDown } from 'lucide-react'

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
  const [isPending,     startTransition]  = useTransition()
  const [isDeclining,   startDecline]     = useTransition()
  const [answers,       setAnswers]       = useState<Record<string, string>>(
    () => Object.fromEntries(questions.map(q => [q.id, '']))
  )
  const [showDecline,   setShowDecline]   = useState(false)
  const [declineNote,   setDeclineNote]   = useState('')
  const [error,         setError]         = useState<string | null>(null)

  function updateAnswer(id: string, val: string) {
    setAnswers(prev => ({ ...prev, [id]: val }))
  }

  function handleAccept() {
    startTransition(async () => {
      setError(null)
      const builtAnswers: OfferAnswer[] = questions.map(q => ({
        id:       q.id,
        question: q.question,
        answer:   answers[q.id] ?? '',
      }))
      const res = await acceptOffer(token, builtAnswers)
      if (!res.success) {
        setError(res.error)
      } else {
        // Reload to show the accepted confirmation screen
        window.location.reload()
      }
    })
  }

  function handleDecline() {
    startDecline(async () => {
      setError(null)
      const res = await declineOffer(token, declineNote.trim() || null)
      if (!res.success) {
        setError(res.error)
      } else {
        window.location.reload()
      }
    })
  }

  // Questions form (used in both the top CTA and the "A Few Questions" section)
  const questionsForm = hasQuestions && (
    <div className="space-y-4 mb-4">
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
    </div>
  )

  if (showOnlyForm) {
    // Just the Q&A form — buttons are in the main CTA card above
    return <>{questionsForm}</>
  }

  return (
    <div id="offer-questions">
      {questionsForm}

      {error != null && (
        <div className="px-4 py-3 rounded-xl mb-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm f-body" style={{ color: '#991B1B' }}>{error}</p>
        </div>
      )}

      {/* Accept */}
      <button
        type="button"
        onClick={handleAccept}
        disabled={isPending || isDeclining}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold f-body transition-all"
        style={{
          background: isPending ? 'rgba(230,126,80,0.6)' : '#E67E50',
          color:      '#fff',
          cursor:     (isPending || isDeclining) ? 'not-allowed' : 'pointer',
          boxShadow:  isPending ? 'none' : '0 4px 24px rgba(230,126,80,0.45)',
          letterSpacing: '0.01em',
        }}
      >
        {isPending
          ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
          : 'Accept this offer →'}
      </button>

      <p className="text-xs f-body text-center mt-2.5 mb-3" style={{ color: 'rgba(10,46,77,0.4)' }}>
        €{depositEur.toFixed(0)} deposit · FjordAnglers will be in touch to confirm
      </p>

      {/* Decline toggle */}
      {!showDecline ? (
        <button
          type="button"
          onClick={() => setShowDecline(true)}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm f-body transition-all"
          style={{
            background: 'transparent',
            color:      'rgba(10,46,77,0.38)',
            border:     '1px solid rgba(10,46,77,0.1)',
            cursor:     'pointer',
          }}
        >
          <ChevronDown size={14} />
          This offer doesn&apos;t work for me
        </button>
      ) : (
        <div className="space-y-2.5 pt-1">
          <div
            className="px-4 py-3 rounded-xl"
            style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.09)' }}
          >
            <p className="text-xs font-semibold f-body mb-2" style={{ color: '#0A2E4D' }}>
              Want to leave a note? (optional)
            </p>
            <textarea
              value={declineNote}
              onChange={e => setDeclineNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm f-body resize-none"
              style={{
                background: 'rgba(10,46,77,0.04)',
                border:     '1px solid rgba(10,46,77,0.1)',
                color:      '#0A2E4D',
                outline:    'none',
              }}
              placeholder="Dates don't work, budget, found another option… or leave blank"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDecline(false)}
              className="flex-1 py-2.5 rounded-xl text-sm f-body"
              style={{ background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.5)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={isDeclining || isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold f-body"
              style={{
                background: isDeclining ? 'rgba(10,46,77,0.3)' : '#0A2E4D',
                color:      '#fff',
                cursor:     isDeclining ? 'not-allowed' : 'pointer',
              }}
            >
              {isDeclining ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
              Decline offer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
