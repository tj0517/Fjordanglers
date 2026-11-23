'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { withdrawGuideRequestAction } from '@/actions/guide-requests'
import type { InquiryGuideRequest } from '@/lib/guide-requests/requests'

/**
 * FA-M.05 — the guide requests of one inquiry: the latest one on top, earlier ones (after a guide
 * change) under "Earlier requests". Each shows sent / opened / answer (accepted, declined with the
 * reason, other dates with the guide's dates and note) / withdrawn. The guide's note is plain text.
 */

const TZ = 'Europe/Warsaw'

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

type Tone = 'done' | 'wait' | 'bad' | 'muted'

function Step({ label, detail, tone, testId }: { label: string; detail?: string | null; tone: Tone; testId: string }) {
  return (
    <li className="flex items-start gap-2.5" data-step={testId} data-tone={tone}>
      <span
        aria-hidden
        className={cn(
          'mt-1 w-2 h-2 rounded-full flex-shrink-0',
          tone === 'done' && 'bg-emerald-500',
          tone === 'wait' && 'bg-yellow-400',
          tone === 'bad'  && 'bg-red-500',
          tone === 'muted' && 'bg-primary/20',
        )}
      />
      <div className="min-w-0">
        <p className="text-xs f-body font-semibold text-primary">{label}</p>
        {detail != null && detail !== '' && <p className="text-[11px] f-body text-primary/55">{detail}</p>}
      </div>
    </li>
  )
}

function AnswerStep({ r }: { r: InquiryGuideRequest }) {
  if (r.answer === 'accepted' && r.answeredAt != null) {
    return <Step testId="answer" tone="done" label="Accepted" detail={when(r.answeredAt)} />
  }
  if (r.answer === 'declined' && r.answeredAt != null) {
    return (
      <Step
        testId="answer"
        tone="bad"
        label={r.note != null ? `Declined — “${r.note}”` : 'Declined'}
        detail={when(r.answeredAt)}
      />
    )
  }
  if (r.answer === 'other_dates' && r.answeredAt != null) {
    return (
      <li className="flex items-start gap-2.5" data-step="answer" data-tone="wait">
        <span aria-hidden className="mt-1 w-2 h-2 rounded-full flex-shrink-0 bg-primary/60" />
        <div className="min-w-0">
          <p className="text-xs f-body font-semibold text-primary">Proposed other dates</p>
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Guide's proposed dates">
            {r.altDates.map(d => (
              <li key={d} className="text-[11px] f-body font-semibold px-2 py-0.5 rounded-full bg-primary/[6%] text-primary border border-primary/20">
                {dayLabel(d)}
              </li>
            ))}
          </ul>
          {r.note != null && (
            <p className="mt-1 text-[11px] f-body text-primary/70 whitespace-pre-wrap" data-testid="guide-note">“{r.note}”</p>
          )}
          <p className="text-[11px] f-body text-primary/55">{when(r.answeredAt)}</p>
        </div>
      </li>
    )
  }
  if (r.withdrawnAt != null) return null
  const expired = Date.parse(r.expiresAt) <= Date.now()
  return expired
    ? <Step testId="answer" tone="muted" label="No answer — link expired" detail={`Expired ${when(r.expiresAt)}`} />
    : <Step testId="answer" tone="wait" label="Waiting for an answer" detail={`Link valid until ${when(r.expiresAt)}`} />
}

function RequestCard({ r, inquiryId, current }: { r: InquiryGuideRequest; inquiryId: string; current: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function withdraw() {
    if (!window.confirm('Withdraw this request? The guide’s link stops working.')) return
    setErr(null)
    start(async () => {
      const res = await withdrawGuideRequestAction(inquiryId, r.requestId)
      if (!res.success) setErr(res.error)
      else router.refresh()
    })
  }

  return (
    <article
      data-testid="guide-request"
      data-request-id={r.requestId}
      className={cn(
        'rounded-[18px] px-4 py-3 border',
        current ? 'bg-[#FDFAF7] border-primary/10' : 'bg-primary/[2%] border-primary/[6%]',
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-bold f-body text-primary">{r.guideName ?? 'Guide removed'}</p>
        {r.withdrawnAt == null && (
          <button
            type="button"
            onClick={withdraw}
            disabled={pending}
            className="px-3 py-1 rounded-xl text-[10px] font-semibold f-body bg-red-500/7 text-red-800 border border-red-500/20 disabled:opacity-60"
          >
            {pending ? '…' : 'Withdraw'}
          </button>
        )}
      </div>
      <ol className="flex flex-col gap-2">
        <Step testId="sent" tone="done" label={`Sent via ${r.channel === 'whatsapp' ? 'WhatsApp' : r.channel}`} detail={when(r.sentAt)} />
        {r.firstOpenedAt != null
          ? <Step testId="opened" tone="done" label="Opened" detail={when(r.firstOpenedAt)} />
          : <Step testId="opened" tone="muted" label="Not opened yet" />}
        <AnswerStep r={r} />
        {r.withdrawnAt != null && (
          <Step testId="withdrawn" tone="muted" label="Withdrawn" detail={when(r.withdrawnAt)} />
        )}
      </ol>
      {err != null && <p role="alert" className="mt-2 text-xs f-body text-red-600">{err}</p>}
    </article>
  )
}

export function GuideRequestTimeline({ inquiryId, requests }: { inquiryId: string; requests: InquiryGuideRequest[] }) {
  if (requests.length === 0) {
    return (
      <section aria-label="Guide requests" className="mb-5">
        <p className="text-xs f-body text-primary/45">No guide request sent yet.</p>
      </section>
    )
  }
  const [latest, ...earlier] = requests
  return (
    <section aria-label="Guide requests" className="mb-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body text-primary/40 mb-2">Latest request</p>
      <RequestCard r={latest} inquiryId={inquiryId} current />
      {earlier.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body text-primary/40 mb-2">
            Earlier requests ({earlier.length})
          </p>
          <div className="flex flex-col gap-2">
            {earlier.map(r => <RequestCard key={r.requestId} r={r} inquiryId={inquiryId} current={false} />)}
          </div>
        </div>
      )}
    </section>
  )
}
