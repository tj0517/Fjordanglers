'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { remindGuideOnWhatsAppAction } from '@/actions/guide-requests'
import type { ReminderState } from '@/lib/guide-requests/reminder'

/**
 * FA-M.06 — "guide hasn't opened" on the inquiry card (latest request) and on the inquiry list row.
 *
 *   not_opened  flag + "Remind on WhatsApp" (WhatsApp requests only). The click records the reminder
 *               on the server (requireAdmin, reminded_at + guide.request_reminded) and only then
 *               shows the wa.me link, once — like the request link in FA-M.05.
 *   reminded    "Reminded X h ago"
 *   expired     "Link expired — send a new request" → the guide cards (send-request flow)
 *
 * `compact` is the list row: smaller, and clicks do not open the row.
 */

function hoursAgo(h: number): string {
  return h < 1 ? 'less than 1 h ago' : `${h} h ago`
}

export function GuideReminderFlag({
  state, inquiryId, compact = false,
}: { state: ReminderState; inquiryId: string; compact?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [waUrl, setWaUrl] = useState<string | null>(null)

  function remind(requestId: string) {
    setErr(null)
    start(async () => {
      const res = await remindGuideOnWhatsAppAction(inquiryId, requestId)
      if (!res.success) { setErr(res.error); return }
      setWaUrl(res.waUrl)
      router.refresh()
    })
  }

  const box = compact
    ? 'mt-1 rounded-lg px-2 py-1 text-[10px]'
    : 'mb-2 rounded-xl px-3 py-2 text-xs'
  const stop = compact ? (e: React.MouseEvent) => e.stopPropagation() : undefined

  if (waUrl != null) {
    return (
      <div data-testid="reminder-recorded" onClick={stop} className={cn(box, 'bg-emerald-500/[6%] border border-emerald-500/25')}>
        {!compact && (
          <p className="f-body font-semibold text-emerald-900 mb-1.5">
            Reminder recorded. Send it from WhatsApp — it points the guide to the link in your earlier message.
          </p>
        )}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-3 py-1 rounded-xl font-bold f-body bg-accent text-primary"
        >
          Open WhatsApp
        </a>
      </div>
    )
  }

  if (state.kind === 'not_opened') {
    return (
      <div
        data-testid="reminder-flag"
        data-state="not_opened"
        onClick={stop}
        className={cn(box, 'bg-amber-400/15 border border-amber-500/30 flex flex-wrap items-center justify-between gap-1.5')}
      >
        <p className="f-body font-semibold text-amber-900">
          {compact
            ? `Hasn’t opened · ${state.hoursSinceSent} h`
            : `Guide hasn’t opened — sent ${state.hoursSinceSent} h ago (reminder after ${state.thresholdHours} h)`}
        </p>
        {state.canRemind
          ? (
            <button
              type="button"
              onClick={() => remind(state.requestId)}
              disabled={pending}
              className="px-2.5 py-0.5 rounded-xl text-[10px] font-bold f-body bg-primary text-white disabled:opacity-60"
            >
              {pending ? '…' : 'Remind on WhatsApp'}
            </button>
          )
          : <span className="text-[10px] f-body text-amber-900/70">Sent by email — no WhatsApp reminder</span>}
        {err != null && <p role="alert" className="basis-full f-body text-red-600">{err}</p>}
      </div>
    )
  }

  if (state.kind === 'reminded') {
    return (
      <p data-testid="reminder-flag" data-state="reminded" className={cn(box, 'f-body font-semibold text-primary/70 bg-primary/[4%] border border-primary/10')}>
        {compact ? `Reminded ${hoursAgo(state.hoursAgo)}` : `Reminded on WhatsApp ${hoursAgo(state.hoursAgo)} — still not opened`}
      </p>
    )
  }

  if (state.kind === 'expired') {
    return (
      <a
        href={compact ? `/admin/inquiries/${inquiryId}?tab=guide#send-request` : '#send-request'}
        onClick={stop}
        data-testid="reminder-flag"
        data-state="expired"
        className={cn(box, 'block f-body font-semibold text-red-800 bg-red-500/7 border border-red-500/20 underline-offset-2 hover:underline')}
      >
        Link expired — send a new request
      </a>
    )
  }

  return null
}
