'use client'

import { useState, useTransition } from 'react'
import type { GuideRequestAnswerView } from '@/lib/guide-requests/page'
import { submitRequestAnswer, type SubmitOutcome } from './actions'
import { DatePicker } from './DatePicker'
import { ExpiredNotice, whatsappHref } from './ExpiredNotice'
import { dayLabel } from './format'
import { HomeScreenNudge } from './HomeScreenNudge'

const MAX_DATES = 3
const MAX_NOTE = 500

type Mode = 'choose' | 'decline' | 'dates'

const NAVY = '#0A2E4D'
const MUTED = 'rgba(10,46,77,0.65)'

export function RequestPanel({
  token, earliestAltDate, initialAnswer,
}: {
  token: string
  earliestAltDate: string
  initialAnswer: GuideRequestAnswerView | null
}) {
  const [answered, setAnswered] = useState(initialAnswer)
  const [wasAnsweredBefore, setWasAnsweredBefore] = useState(false)
  const [expired, setExpired] = useState(false)
  const [mode, setMode] = useState<Mode>('choose')
  const [note, setNote] = useState('')
  const [dates, setDates] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function apply(outcome: SubmitOutcome) {
    switch (outcome.kind) {
      case 'saved':
        setAnswered(outcome.answered); setError(null); return
      case 'already_answered':
        setAnswered(outcome.answered); setWasAnsweredBefore(true); setError(null); return
      case 'date_not_in_future':
        setError(`Pick dates from ${dayLabel(earliestAltDate)} on.`); return
      case 'invalid':
        setError(mode === 'dates'
          ? `Pick 1–${MAX_DATES} dates, then send.`
          : `Keep the reason under ${MAX_NOTE} characters, then send.`)
        return
      case 'expired':
        setExpired(true); return
      case 'error':
        setError('Something went wrong. Try again, or write to us on WhatsApp.'); return
    }
  }

  function send(input: { answer: 'accepted' | 'declined' | 'other_dates'; altDates?: string[]; note?: string }) {
    setError(null)
    startTransition(async () => {
      apply(await submitRequestAnswer(token, input))
    })
  }

  function toggleDate(date: string) {
    setError(null)
    setDates(ds => ds.includes(date)
      ? ds.filter(d => d !== date)
      : ds.length >= MAX_DATES ? ds : [...ds, date].sort())
  }

  if (expired) return <ExpiredNotice />
  if (answered != null) {
    return (
      <>
        <AnsweredView answered={answered} wasAnsweredBefore={wasAnsweredBefore} />
        <HomeScreenNudge />
      </>
    )
  }

  return (
    <section aria-label="Your answer" className="space-y-3">
      {mode === 'choose' && (
        <>
          <button type="button" disabled={pending} onClick={() => send({ answer: 'accepted' })}
            className="w-full py-4 rounded-2xl text-lg font-semibold f-body disabled:opacity-60"
            style={{ background: '#E67E50', color: '#fff' }}>
            {pending ? 'Sending…' : 'Accept'}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={pending} onClick={() => setMode('dates')}
              className="py-3.5 rounded-2xl text-base font-semibold f-body disabled:opacity-60"
              style={{ background: '#fff', color: NAVY, border: `1.5px solid ${NAVY}` }}>
              Other dates
            </button>
            <button type="button" disabled={pending} onClick={() => setMode('decline')}
              className="py-3.5 rounded-2xl text-base font-semibold f-body disabled:opacity-60"
              style={{ background: '#fff', color: NAVY, border: '1.5px solid rgba(10,46,77,0.25)' }}>
              Decline
            </button>
          </div>
        </>
      )}

      {mode === 'decline' && (
        <div className="space-y-3">
          <label htmlFor="decline-reason" className="block text-base font-semibold f-body" style={{ color: NAVY }}>
            Reason <span className="font-normal" style={{ color: MUTED }}>(optional)</span>
          </label>
          <textarea id="decline-reason" value={note} maxLength={MAX_NOTE} rows={3}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. fully booked that week"
            className="w-full rounded-xl p-3 text-base f-body"
            style={{ border: '1px solid rgba(10,46,77,0.2)', color: NAVY, background: '#fff' }} />
          <p className="text-xs f-body text-right" style={{ color: MUTED }}>{note.length}/{MAX_NOTE}</p>
          <button type="button" disabled={pending} onClick={() => send({ answer: 'declined', note })}
            className="w-full py-4 rounded-2xl text-lg font-semibold f-body disabled:opacity-60"
            style={{ background: NAVY, color: '#fff' }}>
            {pending ? 'Sending…' : 'Send decline'}
          </button>
          <BackButton disabled={pending} onClick={() => { setMode('choose'); setError(null) }} />
        </div>
      )}

      {mode === 'dates' && (
        <div className="space-y-3">
          <p className="text-base font-semibold f-body" style={{ color: NAVY }}>
            Pick 1–{MAX_DATES} days you could do instead
          </p>
          <DatePicker earliest={earliestAltDate} selected={dates} max={MAX_DATES} onToggle={toggleDate} />
          {dates.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Picked dates">
              {dates.map(d => (
                <li key={d}>
                  <button type="button" onClick={() => toggleDate(d)} aria-label={`Remove ${dayLabel(d)}`}
                    className="px-3 py-1.5 rounded-full text-sm f-body"
                    style={{ background: 'rgba(10,46,77,0.08)', color: NAVY }}>
                    {dayLabel(d)} ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" disabled={pending || dates.length === 0}
            onClick={() => send({ answer: 'other_dates', altDates: dates })}
            className="w-full py-4 rounded-2xl text-lg font-semibold f-body disabled:opacity-40"
            style={{ background: NAVY, color: '#fff' }}>
            {pending ? 'Sending…' : dates.length === 0 ? 'Pick a date' : `Send ${dates.length} date${dates.length > 1 ? 's' : ''}`}
          </button>
          <BackButton disabled={pending} onClick={() => { setMode('choose'); setError(null) }} />
        </div>
      )}

      {error != null && (
        <p role="alert" className="text-sm f-body rounded-xl px-3 py-2"
          style={{ background: 'rgba(220,38,38,0.08)', color: '#991b1b' }}>
          {error}
        </p>
      )}
    </section>
  )
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-full py-2 text-sm f-body underline" style={{ color: MUTED }}>
      Back
    </button>
  )
}

const HEADLINE: Record<GuideRequestAnswerView['answer'], string> = {
  accepted:    'You accepted this trip',
  declined:    'You declined this trip',
  other_dates: 'You proposed other dates',
}

function AnsweredView({ answered, wasAnsweredBefore }: { answered: GuideRequestAnswerView; wasAnsweredBefore: boolean }) {
  return (
    <section aria-label="Your answer" data-testid="request-answered" className="rounded-2xl p-5"
      style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.1)' }}>
      {wasAnsweredBefore && (
        <p className="text-sm f-body mb-2" style={{ color: MUTED }}>This request was already answered:</p>
      )}
      <h2 className="text-xl font-bold f-display mb-2" style={{ color: NAVY }}>{HEADLINE[answered.answer]}</h2>
      {answered.altDates.length > 0 && (
        <ul className="text-base f-body mb-2 space-y-0.5" style={{ color: NAVY }}>
          {answered.altDates.map(d => <li key={d}>{dayLabel(d)}</li>)}
        </ul>
      )}
      {answered.note != null && (
        <p className="text-base f-body mb-2 whitespace-pre-wrap break-words" style={{ color: NAVY }}>“{answered.note}”</p>
      )}
      <p className="text-sm f-body" style={{ color: MUTED }}>
        {answered.answer === 'accepted'
          ? 'Thanks — we’ll confirm with the client and come back to you.'
          : 'Thanks for letting us know — we’ll take it from here.'}
        {' '}Need to change something?{' '}
        <a href={whatsappHref} rel="noopener noreferrer" target="_blank" className="underline" style={{ color: NAVY }}>
          Write to us on WhatsApp
        </a>.
      </p>
    </section>
  )
}
