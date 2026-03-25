'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { acceptBooking, declineBooking } from '@/actions/bookings'
import RespondCalendar, { fmtDate, fmtShort } from './RespondCalendar'
import type { WeeklySchedule, BlockedRange } from './RespondCalendar'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingRespondFormProps = {
  bookingId:             string
  anglerName:            string
  anglerEmail:           string
  anglerCountry:         string | null
  experienceTitle:       string
  experienceId:          string | null
  coverUrl:              string | null
  windowFrom:            string
  /** All dates the angler originally requested (from requested_dates column) */
  anglerRequestedDates?: string[]
  durationOption:        string | null
  guests:                number
  totalEur:              number
  depositEur:            number | null
  pricePerPersonEur:     number | null
  specialRequests:       string | null
  guideWeeklySchedules:  WeeklySchedule[]
  blockedDates:          BlockedRange[]
  mode?:                 'page' | 'inline'
}

type Phase  = 'action' | 'form' | 'review'
type Action = 'accept' | 'decline'

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#F3EDE4', border: '1.5px solid rgba(10,46,77,0.12)',
  borderRadius: '12px', padding: '10px 13px', fontSize: '14px', color: '#0A2E4D', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: 700,
  textTransform: 'uppercase' as const, letterSpacing: '0.18em',
  color: 'rgba(10,46,77,0.45)', marginBottom: '6px',
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SummaryRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3 items-baseline">
      <span className="text-[11px] f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)' }}>{label}</span>
      <span className="text-[12px] f-body font-semibold text-right"
            style={{ color: accent ? '#16A34A' : '#0A2E4D' }}>{value}</span>
    </div>
  )
}

function ReviewRow({ label, value, accent = false, highlight = false }:
  { label: string; value: string; accent?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4 items-baseline">
      <span className="text-[11px] f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)' }}>{label}</span>
      <span className="text-sm f-body font-semibold text-right"
            style={{ color: highlight ? '#E67E50' : accent ? '#16A34A' : '#0A2E4D' }}>{value}</span>
    </div>
  )
}

function BookingSummaryCard({ anglerName, anglerCountry, experienceTitle, windowFrom,
  anglerRequestedDates, durationOption, guests, totalEur, depositEur }: {
  anglerName: string; anglerCountry: string | null; experienceTitle: string
  windowFrom: string; anglerRequestedDates?: string[]; durationOption: string | null; guests: number
  totalEur: number; depositEur: number | null
}) {
  const multiDates = anglerRequestedDates && anglerRequestedDates.length > 1

  return (
    <div className="p-5 rounded-2xl flex flex-col gap-3"
         style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}>
      <p style={labelStyle}>Booking Summary</p>
      <div className="flex flex-col gap-2">
        <SummaryRow label="Angler"  value={`${anglerCountry ? `${anglerCountry} · ` : ''}${anglerName}`} />
        <SummaryRow label="Trip"    value={experienceTitle} />
        {multiDates ? (
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.45)' }}>
                Requested ({anglerRequestedDates!.length} dates)
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {anglerRequestedDates!.map(d => (
                <span
                  key={d}
                  className="text-[10px] f-body px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(59,130,246,0.12)', color: '#2563EB' }}
                >
                  {fmtShort(d)}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <SummaryRow label="Requested" value={`${fmtShort(windowFrom)}${durationOption ? ` · ${durationOption}` : ''}`} />
        )}
        <SummaryRow label="Guests"  value={`${guests} pax`} />
        <SummaryRow label="Total"   value={`€${totalEur}`} accent />
        {depositEur != null && <SummaryRow label="Deposit" value={`€${depositEur} (30%)`} />}
      </div>
    </div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-70"
      style={{ background: 'rgba(10,46,77,0.07)' }} aria-label="Go back">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#0A2E4D" strokeWidth="1.5">
        <polyline points="7,2 3,6 7,10" /><line x1="3" y1="6" x2="11" y2="6" />
      </svg>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookingRespondForm({
  bookingId, anglerName, anglerEmail: _e, anglerCountry,
  experienceTitle, experienceId: _ei, coverUrl: _c,
  windowFrom, anglerRequestedDates, durationOption, guests, totalEur, depositEur, pricePerPersonEur,
  specialRequests, guideWeeklySchedules, blockedDates,
  mode = 'inline',
}: BookingRespondFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [phase,  setPhase]  = useState<Phase>('action')
  const [action, setAction] = useState<Action | null>(null)

  const [confirmedDays, setConfirmedDays] = useState<string[]>([])
  const [guideNote,     setGuideNote]    = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [proposeAlts,   setProposeAlts]   = useState(false)
  const [altFrom,       setAltFrom]       = useState<string | null>(null)
  const [altTo,         setAltTo]         = useState<string | null>(null)
  const [error,         setError]         = useState<string | null>(null)

  function selectAction(a: Action) { setAction(a); setPhase('form'); setError(null) }
  function goBack() { setError(null); setPhase(phase === 'review' ? 'form' : 'action') }
  function closeOverlay() { setError(null); setPhase('action') }

  function goReview() {
    setError(null)
    if (action === 'decline' && proposeAlts && (!altFrom || !altTo)) {
      setError('Please select both start and end dates for the alternative period.')
      return
    }
    setPhase('review')
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      if (action === 'accept') {
        const r = await acceptBooking(bookingId, {
          confirmedDays: confirmedDays.length > 0 ? confirmedDays : undefined,
          guideNote:     guideNote.trim() || undefined,
        })
        if (r.error) { setError(r.error); setPhase('form'); return }
      } else {
        const r = await declineBooking(
          bookingId,
          declineReason.trim() || undefined,
          proposeAlts && altFrom && altTo ? { from: altFrom, to: altTo } : undefined,
        )
        if (r.error) { setError(r.error); setPhase('form'); return }
      }
      router.push(`/dashboard/bookings/${bookingId}?responded=true`)
    })
  }

  // inline mode: form + review render as full-screen overlay
  const useOverlay = mode === 'inline'

  // ── Action phase ──────────────────────────────────────────────────────────

  if (phase === 'action') {
    return (
      <div className={mode === 'page' ? 'px-4 py-8 sm:px-8 sm:py-12 max-w-[720px] mx-auto' : 'pt-5'}>
        {mode === 'page' && (
          <Link href={`/dashboard/bookings/${bookingId}`}
            className="inline-flex items-center gap-1.5 text-xs f-body mb-8 transition-opacity hover:opacity-70"
            style={{ color: 'rgba(10,46,77,0.45)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="7,2 3,6 7,10" /><line x1="3" y1="6" x2="11" y2="6" />
            </svg>
            Back to booking
          </Link>
        )}

        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-[0.22em] f-body mb-1"
             style={{ color: 'rgba(10,46,77,0.38)' }}>New booking request</p>
          <h2 className="text-[#0A2E4D] text-xl font-bold f-display">
            {anglerName} wants to book
          </h2>
          <p className="text-sm f-body mt-1" style={{ color: 'rgba(10,46,77,0.55)' }}>
            {experienceTitle} · {guests} {guests === 1 ? 'guest' : 'guests'} ·{' '}
            {anglerRequestedDates && anglerRequestedDates.length > 1
              ? `${anglerRequestedDates.length} dates`
              : fmtShort(windowFrom)}
            {durationOption ? ` · ${durationOption}` : ''} · €{totalEur}
          </p>
        </div>

        {specialRequests != null && (
          <div className="mb-5 p-4 rounded-2xl"
               style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] mb-1.5 f-body font-bold"
               style={{ color: 'rgba(59,130,246,0.7)' }}>Special requests</p>
            <p className="text-sm f-body leading-relaxed" style={{ color: '#0A2E4D' }}>{specialRequests}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionCard
            variant="accept"
            title="Accept booking"
            description="Confirm you can take this trip. Pick the exact date and optionally add a personal note."
            cta="Accept & set date →"
            onClick={() => selectAction('accept')}
          />
          <ActionCard
            variant="decline"
            title="Decline booking"
            description="Can't take this trip. Explain why and propose alternative dates when you're available."
            cta="Decline & respond →"
            onClick={() => selectAction('decline')}
          />
        </div>
      </div>
    )
  }

  // ── Form phase ────────────────────────────────────────────────────────────

  if (phase === 'form') {
    const isAcc = action === 'accept'
    const formContent = (
      <div className="px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center gap-4 mb-6">
          <BackBtn onClick={goBack} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] f-body"
               style={{ color: isAcc ? 'rgba(22,163,74,0.7)' : 'rgba(220,38,38,0.7)' }}>
              {isAcc ? 'Accepting booking' : 'Declining booking'}
            </p>
            <h2 className="text-[#0A2E4D] text-lg sm:text-xl font-bold f-display">
              {isAcc ? 'Confirm trip details' : 'Send your response'}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
          <div className="flex flex-col gap-5">
            {isAcc ? (
              <>
                <div>
                  <p style={labelStyle}>
                    Confirm trip days
                    <span className="ml-1 normal-case tracking-normal font-normal"
                          style={{ color: 'rgba(10,46,77,0.35)' }}>
                      (optional — click to select, click again to deselect)
                    </span>
                  </p>
                  <RespondCalendar
                    calMode="multi"
                    anglerWindowFrom={windowFrom}
                    anglerDates={anglerRequestedDates}
                    weeklySchedules={guideWeeklySchedules}
                    blockedDates={blockedDates}
                    selectedDays={confirmedDays}
                    onMultiChange={setConfirmedDays}
                    disabled={isPending}
                  />
                  {confirmedDays.length > 0 && (() => {
                    const n = confirmedDays.length
                    const computedTotal = pricePerPersonEur != null
                      ? Math.round(pricePerPersonEur * guests * n * 1.05 * 100) / 100
                      : null
                    return (
                      <div className="mt-3 px-4 py-3 rounded-xl flex items-center justify-between gap-3"
                           style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)' }}>
                        <div className="flex items-center gap-2">
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                               stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1.5,6.5 5.5,10.5 11.5,2.5" />
                          </svg>
                          <span className="text-sm f-body font-semibold" style={{ color: '#16A34A' }}>
                            {n} day{n !== 1 ? 's' : ''} selected
                          </span>
                        </div>
                        {computedTotal != null && (
                          <div className="text-right">
                            <span className="text-[10px] f-body block" style={{ color: 'rgba(10,46,77,0.45)' }}>Updated total</span>
                            <span className="text-base f-display font-bold" style={{ color: '#0A2E4D' }}>€{computedTotal}</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
                <div>
                  <label style={labelStyle}>
                    Message to angler
                    <span className="ml-1 normal-case tracking-normal font-normal"
                          style={{ color: 'rgba(10,46,77,0.35)' }}>(optional)</span>
                  </label>
                  <textarea rows={4}
                    placeholder="Add details: what to bring, meeting point, schedule…"
                    value={guideNote} onChange={e => setGuideNote(e.target.value)}
                    disabled={isPending} className="f-body resize-none"
                    style={{ ...inputStyle, height: 'auto' }} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>
                    Reason for declining
                    <span className="ml-1 normal-case tracking-normal font-normal"
                          style={{ color: 'rgba(10,46,77,0.35)' }}>(optional)</span>
                  </label>
                  <textarea rows={3}
                    placeholder="e.g. Already booked for those dates…"
                    value={declineReason} onChange={e => setDeclineReason(e.target.value)}
                    disabled={isPending} className="f-body resize-none"
                    style={{ ...inputStyle, height: 'auto' }} />
                </div>

                <div>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p style={{ ...labelStyle, marginBottom: 4 }}>Propose alternative dates</p>
                      <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        Show the angler when you ARE available — an automatic message will be sent.
                      </p>
                    </div>
                    <button type="button"
                      onClick={() => { setProposeAlts(v => !v); if (proposeAlts) { setAltFrom(null); setAltTo(null) } }}
                      disabled={isPending}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5"
                      style={{ background: proposeAlts ? '#1B4F72' : 'rgba(10,46,77,0.15)' }}
                      aria-pressed={proposeAlts}>
                      <span className="inline-block w-4 h-4 rounded-full bg-white shadow transition-transform"
                            style={{ transform: proposeAlts ? 'translateX(24px)' : 'translateX(4px)' }} />
                    </button>
                  </div>

                  {proposeAlts && (
                    <div className="flex flex-col gap-4">
                      <RespondCalendar
                        calMode="range"
                        anglerWindowFrom={windowFrom}
                        anglerDates={anglerRequestedDates}
                        weeklySchedules={guideWeeklySchedules}
                        blockedDates={blockedDates}
                        selectedFrom={altFrom}
                        selectedTo={altTo}
                        onChange={(f, t) => { setAltFrom(f); setAltTo(t) }}
                        disabled={isPending}
                      />
                      {altFrom != null && altTo != null && (
                        <div className="p-4 rounded-xl"
                             style={{ background: 'rgba(27,79,114,0.04)', border: '1.5px dashed rgba(27,79,114,0.22)' }}>
                          <p style={{ ...labelStyle, marginBottom: '8px', color: 'rgba(27,79,114,0.65)' }}>
                            Auto-message preview
                          </p>
                          <p className="text-[12px] f-body leading-relaxed whitespace-pre-wrap"
                             style={{ color: 'rgba(10,46,77,0.65)' }}>
                            {declineReason.trim()
                              ? `Unfortunately those dates don't work for me — ${declineReason.trim().replace(/\.$/, '')}.\n\n`
                              : `Unfortunately I'm unable to take the booking for those dates.\n\n`}
                            {'📅 I\'m available on: '}
                            {altFrom === altTo ? fmtDate(altFrom) : `${fmtDate(altFrom)} – ${fmtDate(altTo)}`}
                            {'\n\nFeel free to send a new booking request or message me here.'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <BookingSummaryCard anglerName={anglerName} anglerCountry={anglerCountry}
              experienceTitle={experienceTitle} windowFrom={windowFrom}
              anglerRequestedDates={anglerRequestedDates}
              durationOption={durationOption} guests={guests}
              totalEur={totalEur} depositEur={depositEur} />
            {specialRequests != null && (
              <div className="p-4 rounded-2xl"
                   style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)' }}>
                <p style={{ ...labelStyle, color: 'rgba(59,130,246,0.7)' }}>Special requests</p>
                <p className="text-sm f-body leading-relaxed" style={{ color: '#0A2E4D' }}>{specialRequests}</p>
              </div>
            )}
            {!isAcc && (
              <div className="p-4 rounded-2xl"
                   style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="text-xs f-body font-semibold mb-1" style={{ color: '#DC2626' }}>⚠️ Declining</p>
                <p className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
                  The angler will be notified and no payment will be collected.
                </p>
              </div>
            )}
          </div>
        </div>

        {error != null && <ErrorBanner message={error} />}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={goReview}
            disabled={isPending || (action === 'decline' && proposeAlts && (!altFrom || !altTo))}
            className="px-7 py-3 rounded-2xl text-white font-semibold text-sm f-body transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: isAcc ? '#16A34A' : '#DC2626' }}>
            Review &amp; confirm →
          </button>
        </div>
      </div>
    )

    if (useOverlay) {
      return <FullScreenOverlay onClose={closeOverlay}>{formContent}</FullScreenOverlay>
    }
    return formContent
  }

  // ── Review phase ──────────────────────────────────────────────────────────

  const isAccept = action === 'accept'

  const reviewContent = (
    <div className="px-6 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center gap-3 mb-5">
        <BackBtn onClick={goBack} />
        <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>Back to edit</span>
      </div>

      <div className="p-6 rounded-3xl mb-5"
           style={{
             background: isAccept ? 'rgba(22,163,74,0.04)' : 'rgba(239,68,68,0.04)',
             border: `2px solid ${isAccept ? 'rgba(22,163,74,0.25)' : 'rgba(239,68,68,0.2)'}`,
           }}>
        <div className="flex items-center gap-4 mb-5 pb-5"
             style={{ borderBottom: '1px solid rgba(10,46,77,0.08)' }}>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: isAccept ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.12)' }}>
            {isAccept ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                   stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2.5,10 8,15.5 17.5,5.5" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                   stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round">
                <line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] f-body"
               style={{ color: isAccept ? 'rgba(22,163,74,0.7)' : 'rgba(220,38,38,0.7)' }}>
              {isAccept ? 'You are accepting' : 'You are declining'}
            </p>
            <h2 className="text-base font-bold f-display" style={{ color: '#0A2E4D' }}>
              {anglerName}&apos;s booking
            </h2>
            <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>{experienceTitle}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <ReviewRow
            label="Requested"
            value={
              anglerRequestedDates && anglerRequestedDates.length > 1
                ? `${anglerRequestedDates.length} dates: ${anglerRequestedDates.map(d => fmtShort(d)).join(', ')}`
                : `${fmtShort(windowFrom)}${durationOption ? ` · ${durationOption}` : ''}`
            }
          />
          <ReviewRow label="Guests" value={`${guests} pax`} />
          <ReviewRow label="Total"  value={`€${totalEur}`} accent />
          {isAccept ? (
            <>
              <ReviewRow
                label={`Confirmed days${confirmedDays.length > 0 ? ` (${confirmedDays.length})` : ''}`}
                value={
                  confirmedDays.length === 0
                    ? 'Not set — coordinate in chat'
                    : confirmedDays.length === 1
                      ? fmtDate(confirmedDays[0])
                      : confirmedDays.length <= 3
                        ? confirmedDays.map(d => fmtShort(d)).join(', ')
                        : `${fmtShort(confirmedDays[0])} … ${fmtShort(confirmedDays[confirmedDays.length - 1])}`
                }
                highlight={confirmedDays.length > 0}
              />
              {confirmedDays.length > 0 && pricePerPersonEur != null && (() => {
                const computedTotal = Math.round(pricePerPersonEur * guests * confirmedDays.length * 1.05 * 100) / 100
                return computedTotal !== totalEur ? (
                  <ReviewRow
                    label="Updated total"
                    value={`€${computedTotal} (${confirmedDays.length} days × €${pricePerPersonEur}/person × ${guests} pax)`}
                    accent
                  />
                ) : null
              })()}
              {guideNote.trim() !== '' && (
                <div className="pt-4 mt-1" style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}>
                  <p style={{ ...labelStyle, marginBottom: 8 }}>Your message</p>
                  <p className="text-sm f-body leading-relaxed whitespace-pre-wrap"
                     style={{ color: '#0A2E4D' }}>{guideNote.trim()}</p>
                </div>
              )}
            </>
          ) : (
            <>
              {declineReason.trim() !== '' && <ReviewRow label="Reason" value={declineReason.trim()} />}
              {proposeAlts && altFrom != null && altTo != null && (
                <ReviewRow
                  label="Proposed dates"
                  value={altFrom === altTo ? fmtDate(altFrom) : `${fmtDate(altFrom)} – ${fmtDate(altTo)}`}
                  highlight
                />
              )}
            </>
          )}
        </div>
      </div>

      {error != null && <ErrorBanner message={error} />}

      <button type="button" onClick={handleSubmit} disabled={isPending}
        className="w-full py-3.5 rounded-2xl text-white font-bold text-base f-body transition-all hover:brightness-110 disabled:opacity-50"
        style={{ background: isAccept ? '#16A34A' : '#DC2626' }}>
        {isPending
          ? (isAccept ? 'Accepting…' : 'Declining…')
          : (isAccept ? '✓ Confirm acceptance' : '✗ Confirm decline')}
      </button>

      {mode === 'page' && (
        <p className="text-center mt-4 text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Changed your mind?{' '}
          <Link href={`/dashboard/bookings/${bookingId}`}
                className="underline underline-offset-2 hover:opacity-70"
                style={{ color: 'rgba(10,46,77,0.5)' }}>
            Back to booking details
          </Link>
        </p>
      )}
    </div>
  )

  if (useOverlay) {
    return <FullScreenOverlay onClose={closeOverlay}>{reviewContent}</FullScreenOverlay>
  }
  return reviewContent
}

// ─── ActionCard ───────────────────────────────────────────────────────────────

function ActionCard({ variant, title, description, cta, onClick }: {
  variant: 'accept' | 'decline'
  title: string; description: string; cta: string; onClick: () => void
}) {
  const isAcc = variant === 'accept'
  return (
    <button type="button" onClick={onClick}
      className="text-left p-6 rounded-3xl transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: isAcc ? 'rgba(22,163,74,0.05)' : 'rgba(239,68,68,0.04)',
        border: `2px solid ${isAcc ? 'rgba(22,163,74,0.2)' : 'rgba(239,68,68,0.15)'}`,
      }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
           style={{ background: isAcc ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.1)' }}>
        {isAcc ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
               stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2.5,10 8,15.5 17.5,5.5" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
               stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round">
            <line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-bold f-display mb-1.5"
          style={{ color: isAcc ? '#16A34A' : '#B91C1C' }}>{title}</h3>
      <p className="text-[13px] f-body leading-relaxed mb-4"
         style={{ color: 'rgba(10,46,77,0.6)' }}>{description}</p>
      <span className="text-sm font-semibold f-body"
            style={{ color: isAcc ? '#16A34A' : '#B91C1C' }}>{cta}</span>
    </button>
  )
}

// ─── ErrorBanner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-5 px-4 py-3 rounded-xl text-sm f-body"
         style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#DC2626' }}>
      {message}
    </div>
  )
}

// ─── FullScreenOverlay ────────────────────────────────────────────────────────

function FullScreenOverlay({ children, onClose }: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(10,46,77,0.55)',
          backdropFilter: 'blur(6px)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Scrollable area */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          height: '100%', overflowY: 'auto',
          display: 'flex', justifyContent: 'center',
          padding: '32px 16px 64px',
        }}
      >
        {/* Modal card — stop propagation so clicks inside don't close */}
        <div
          style={{
            width: '100%', maxWidth: '900px',
            background: '#FDFAF7',
            borderRadius: '28px',
            boxShadow: '0 32px 96px rgba(10,46,77,0.25)',
            height: 'fit-content',
          }}
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
