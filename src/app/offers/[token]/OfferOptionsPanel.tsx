'use client'

/**
 * OfferOptionsPanel — angler selects their preferred option and accepts the offer.
 *
 * Shows 2-3 option cards. Once the angler picks one, the CTA card updates to show
 * that option's price and the accept/decline flow begins.
 */

import { useState, useTransition } from 'react'
import { acceptOffer, declineOffer } from '@/actions/inquiries'
import type { OfferOptionInput, OfferQuestion, OfferAnswer, ScheduleEntry } from '@/actions/inquiries'
import { CheckCircle2, Loader2, ChevronDown, Shield } from 'lucide-react'

const OPTION_LABELS = ['A', 'B', 'C']

interface Props {
  token:          string
  options:        OfferOptionInput[]
  questions:      OfferQuestion[]
  refundReason:   string | null
  requestedDates: string[]
  partySize:      number
  guideName:      string
}

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

export function OfferOptionsPanel({
  token,
  options,
  questions,
  refundReason,
  requestedDates,
  partySize,
  guideName,
}: Props) {
  const [selectedId,   setSelectedId]   = useState<string | null>(options.length === 1 ? options[0].id : null)
  const [isPending,    startTransition] = useTransition()
  const [isDeclining,  startDecline]    = useTransition()
  const [answers,      setAnswers]      = useState<Record<string, string>>(
    () => Object.fromEntries(questions.map(q => [q.id, '']))
  )
  const [showDecline,  setShowDecline]  = useState(false)
  const [declineNote,  setDeclineNote]  = useState('')
  const [error,        setError]        = useState<string | null>(null)

  const selectedOpt = options.find(o => o.id === selectedId) ?? null
  const hasQuestions = questions.length > 0

  function updateAnswer(id: string, val: string) {
    setAnswers(prev => ({ ...prev, [id]: val }))
  }

  function handleAccept() {
    if (selectedOpt == null) return
    startTransition(async () => {
      setError(null)
      const builtAnswers: OfferAnswer[] = questions.map(q => ({
        id:       q.id,
        question: q.question,
        answer:   answers[q.id] ?? '',
      }))
      const res = await acceptOffer(token, builtAnswers, selectedOpt.id)
      if (!res.success) {
        setError(res.error)
      } else {
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

  return (
    <div className="space-y-4">

      {/* ── Option cards ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-sm font-bold f-body mb-3" style={{ color: '#0A2E4D' }}>
          {options.length === 1 ? 'Your Offer' : `Choose your option (${options.length} options)`}
        </p>
        <div className={`grid gap-3 ${options.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {options.map((opt, i) => {
            const isSelected = opt.id === selectedId
            const balance    = opt.totalEur - opt.depositEur

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedId(opt.id)}
                className="text-left rounded-2xl p-5 transition-all"
                style={{
                  background:  isSelected ? '#0A2E4D' : '#FFFFFF',
                  border:      isSelected
                    ? '2px solid #0A2E4D'
                    : '2px solid rgba(10,46,77,0.1)',
                  boxShadow:   isSelected
                    ? '0 8px 32px rgba(10,46,77,0.2)'
                    : '0 2px 8px rgba(10,46,77,0.06)',
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(10,46,77,0.38)' }}>
                      Option {OPTION_LABELS[i] ?? i + 1}
                    </p>
                    {opt.title.trim() !== '' && (
                      <p className="text-sm font-bold f-display leading-snug"
                        style={{ color: isSelected ? '#FFFFFF' : '#0A2E4D' }}>
                        {opt.title}
                      </p>
                    )}
                  </div>
                  {/* Selection indicator */}
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: isSelected ? '#E67E50' : 'transparent',
                      border:     isSelected ? 'none' : '2px solid rgba(10,46,77,0.2)',
                    }}
                  >
                    {isSelected && <CheckCircle2 size={13} style={{ color: '#fff' }} />}
                  </div>
                </div>

                {/* Pricing */}
                {opt.totalEur > 0 && (
                  <div className="mb-3">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-2xl font-bold f-display"
                        style={{ color: isSelected ? '#E67E50' : '#0A2E4D' }}>
                        €{opt.totalEur.toFixed(0)}
                      </span>
                      <span className="text-xs f-body"
                        style={{ color: isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(10,46,77,0.4)' }}>
                        total
                      </span>
                    </div>
                    {opt.depositEur > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] f-body"
                        style={{ color: isSelected ? 'rgba(255,255,255,0.6)' : 'rgba(10,46,77,0.5)' }}>
                        <span>
                          <span style={{ color: isSelected ? '#E67E50' : '#E67E50', fontWeight: 700 }}>
                            €{opt.depositEur.toFixed(0)}
                          </span>{' '}
                          deposit now
                        </span>
                        <span>€{balance.toFixed(0)} to guide</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Inclusions preview */}
                {opt.inclusions.length > 0 && (
                  <ul className="space-y-1">
                    {opt.inclusions.slice(0, 3).map((item, j) => (
                      <li key={j} className="flex items-center gap-2 text-[11px] f-body"
                        style={{ color: isSelected ? 'rgba(255,255,255,0.65)' : 'rgba(10,46,77,0.6)' }}>
                        <span style={{ color: '#16a34a', flexShrink: 0 }}>✓</span>
                        {item}
                      </li>
                    ))}
                    {opt.inclusions.length > 3 && (
                      <li className="text-[11px] f-body"
                        style={{ color: isSelected ? 'rgba(255,255,255,0.4)' : 'rgba(10,46,77,0.35)' }}>
                        +{opt.inclusions.length - 3} more
                      </li>
                    )}
                  </ul>
                )}

                {/* Option note */}
                {opt.notes != null && opt.notes.trim() !== '' && (
                  <p className="text-[11px] f-body mt-2 italic"
                    style={{ color: isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(10,46,77,0.45)' }}>
                    {opt.notes}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Selected option details ───────────────────────────────────────────── */}
      {selectedOpt != null && (
        <div className="p-6 rounded-2xl"
          style={{
            background: '#FFFFFF',
            border:     '1px solid rgba(10,46,77,0.08)',
            boxShadow:  '0 8px 40px rgba(10,46,77,0.12)',
          }}>

          {/* Price summary */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
            <div className="text-center">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.06em] sm:tracking-[0.1em] f-body mb-1"
                style={{ color: 'rgba(10,46,77,0.4)' }}>Total</p>
              <p className="text-xl sm:text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                €{selectedOpt.totalEur.toFixed(0)}
              </p>
            </div>
            <div className="text-center"
              style={{ borderLeft: '1px solid rgba(10,46,77,0.06)', borderRight: '1px solid rgba(10,46,77,0.06)' }}>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.06em] sm:tracking-[0.1em] f-body mb-1"
                style={{ color: 'rgba(10,46,77,0.4)' }}>Deposit</p>
              <p className="text-xl sm:text-2xl font-bold f-display" style={{ color: '#E67E50' }}>
                €{selectedOpt.depositEur.toFixed(0)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.06em] sm:tracking-[0.1em] f-body mb-1"
                style={{ color: 'rgba(10,46,77,0.4)' }}>To guide</p>
              <p className="text-xl sm:text-2xl font-bold f-display" style={{ color: '#0A2E4D' }}>
                €{(selectedOpt.totalEur - selectedOpt.depositEur).toFixed(0)}
              </p>
            </div>
          </div>

          {/* Refund notice */}
          {(selectedOpt.refundReason ?? refundReason) != null && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-4"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Shield size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p className="text-xs font-bold f-body mb-0.5" style={{ color: '#065F46' }}>
                  Refundable deposit
                </p>
                <p className="text-sm f-body" style={{ color: '#047857' }}>
                  {selectedOpt.refundReason ?? refundReason}
                </p>
              </div>
            </div>
          )}

          {/* Trip meta */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-5 text-sm f-body"
            style={{ color: 'rgba(10,46,77,0.6)' }}>
            <span>{fmtDates(requestedDates)}</span>
            <span>{partySize} {partySize === 1 ? 'angler' : 'anglers'}</span>
            <span>{guideName}</span>
          </div>

          {/* Questions */}
          {hasQuestions && (
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
          )}

          {/* Error */}
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
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold f-body"
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
              : `Accept Option ${OPTION_LABELS[options.findIndex(o => o.id === selectedId)] ?? ''} →`}
          </button>

          <p className="text-xs f-body text-center mt-2.5 mb-3" style={{ color: 'rgba(10,46,77,0.4)' }}>
            €{selectedOpt.depositEur.toFixed(0)} deposit · FjordAnglers will be in touch to confirm
          </p>

          {/* Decline toggle */}
          {!showDecline ? (
            <button
              type="button"
              onClick={() => setShowDecline(true)}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm f-body"
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
              <div className="px-4 py-3 rounded-xl"
                style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.09)' }}>
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
      )}

      {/* ── Selected option: inclusions + schedule ────────────────────────────── */}
      {selectedOpt != null && (
        <>
          {/* Full inclusions */}
          {selectedOpt.inclusions.length > 0 && (
            <div className="p-6 rounded-2xl"
              style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">✅</span>
                <h2 className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
                  {`What's Included — €${selectedOpt.totalEur.toFixed(0)}`}
                </h2>
              </div>
              <ul className="space-y-2.5">
                {selectedOpt.inclusions.map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                    <span className="text-sm f-body" style={{ color: '#374151' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Schedule */}
          {selectedOpt.schedule.length > 0 && (
            <div className="p-6 rounded-2xl"
              style={{ background: '#FFFFFF', border: '1px solid rgba(10,46,77,0.08)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🗓️</span>
                <h2 className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>Trip Schedule</h2>
              </div>
              <ScheduleTimeline entries={selectedOpt.schedule} />
            </div>
          )}
        </>
      )}

      {/* Prompt to select if nothing selected yet */}
      {selectedOpt == null && options.length > 1 && (
        <p className="text-sm f-body text-center py-2" style={{ color: 'rgba(10,46,77,0.45)' }}>
          ↑ Pick an option above to see pricing and details
        </p>
      )}
    </div>
  )
}

// ─── Schedule timeline (shared with main offer page) ─────────────────────────

function ScheduleTimeline({ entries }: { entries: ScheduleEntry[] }) {
  return (
    <ol className="relative" style={{ paddingLeft: '28px' }}>
      <div
        className="absolute left-0 top-2 bottom-2"
        style={{
          left:         '9px',
          width:        '2px',
          background:   'linear-gradient(to bottom, #E67E50, rgba(230,126,80,0.15))',
          borderRadius: '999px',
        }}
      />
      {entries.map((entry, i) => (
        <li key={entry.id ?? i} className="relative mb-6 last:mb-0">
          <div
            className="absolute flex items-center justify-center"
            style={{
              left:       '-28px',
              top:        '2px',
              width:      '18px',
              height:     '18px',
              borderRadius: '50%',
              background:   '#E67E50',
              border:       '2.5px solid #fff',
              boxShadow:    '0 0 0 2px rgba(230,126,80,0.2)',
              flexShrink:   0,
            }}
          />
          <div>
            {entry.label != null && entry.label !== '' && (
              <span
                className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] f-body px-2 py-0.5 rounded-full mb-1.5"
                style={{ background: 'rgba(230,126,80,0.12)', color: '#C4623A' }}
              >
                {entry.label}
              </span>
            )}
            {entry.title != null && entry.title !== '' && (
              <p className="text-sm font-semibold f-body mb-1" style={{ color: '#0A2E4D' }}>
                {entry.title}
              </p>
            )}
            {entry.description != null && entry.description !== '' && (
              <p className="text-sm f-body leading-relaxed" style={{ color: '#374151' }}>
                {entry.description}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
