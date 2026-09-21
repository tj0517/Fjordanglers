'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, MessageSquare, Mail, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendMessageFromThread, proposeDraft } from '@/actions/messages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Channel = 'email' | 'whatsapp' | 'instagram'

function isWaWindowOpen(waLastInboundAt: string | null): boolean {
  if (!waLastInboundAt) return false
  return Date.now() - new Date(waLastInboundAt).getTime() < 24 * 60 * 60 * 1000
}

export function MessageComposer({
  inquiryId,
  guideAssigned    = false,
  anglerHasPhone   = false,
  guideHasPhone    = false,
  waLastInboundAt  = null,
  igEnabled        = false,
}: {
  inquiryId:       string
  guideAssigned?:  boolean
  anglerHasPhone?: boolean
  guideHasPhone?:  boolean
  /** ISO timestamp of last inbound WA message on this inquiry — determines 24-h window. */
  waLastInboundAt?: string | null
  igEnabled?:      boolean
  /** WA character limit for display (160 for template, 4096 for freeform). */
  _waCharLimit?:   number
}) {
  const router = useRouter()

  const [channel,       setChannel]       = useState<Channel>('email')
  const [counterpart,   setCounterpart]   = useState<'angler' | 'guide'>('angler')
  const [subject,       setSubject]       = useState('')
  const [body,          setBody]          = useState('')
  const [isPending,     startTransition]  = useTransition()
  const [error,         setError]         = useState<string | null>(null)
  const [sent,          setSent]          = useState(false)
  const [draftPending,  startDraft]       = useTransition()
  const [draftError,    setDraftError]    = useState<string | null>(null)
  const [draftId,       setDraftId]       = useState<string | null>(null)

  const waOpen = isWaWindowOpen(waLastInboundAt ?? null)

  // WA only available if the chosen counterpart has a phone
  const waAvailable = channel === 'whatsapp'
    ? (counterpart === 'angler' ? anglerHasPhone : guideHasPhone)
    : true

  function handlePropose() {
    setDraftError(null)
    startDraft(async () => {
      const res = await proposeDraft(inquiryId, counterpart, channel)
      if (res.success) {
        setBody(res.text)
        setDraftId(res.draftId)
        if (res.subject != null) setSubject(res.subject)
        router.refresh()
      } else {
        setDraftError(res.error)
      }
    })
  }

  function handleSend() {
    setError(null)
    startTransition(async () => {
      const res = await sendMessageFromThread(inquiryId, {
        channel,
        counterpart,
        subject: subject.trim() || undefined,
        body:    body.trim(),
        draftId: draftId ?? undefined,
      })
      if (res.success) {
        setSubject('')
        setBody('')
        setDraftId(null)
        setSent(true)
        setTimeout(() => setSent(false), 4000)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
        <Check size={14} className="text-emerald-300 flex-shrink-0" />
        <p className="text-sm font-semibold f-body text-emerald-300">
          Message sent to {counterpart}
        </p>
      </div>
    )
  }

  const isTemplatePath = channel === 'whatsapp' && !waOpen
  const canSend = channel === 'instagram'
    ? igEnabled
    : isTemplatePath
      ? waAvailable
      : body.trim() !== ''

  const CHANNELS: { id: Channel; label: string; icon: React.ReactNode; disabled?: boolean; reason?: string }[] = [
    { id: 'email',     label: 'Email',     icon: <Mail size={12} /> },
    { id: 'whatsapp',  label: 'WhatsApp',  icon: <MessageSquare size={12} />,
      disabled: counterpart === 'angler' ? !anglerHasPhone : !guideHasPhone,
      reason: 'No phone number on record' },
    { id: 'instagram', label: 'Instagram', icon: <span className="text-[11px] font-bold">IG</span>,
      disabled: !igEnabled, reason: 'Instagram not configured' },
  ]

  return (
    <div className="space-y-3">
      {/* Channel selector */}
      <div className="flex gap-1.5">
        {CHANNELS.map(ch => (
          <Button
            key={ch.id}
            type="button"
            disabled={ch.disabled}
            title={ch.disabled ? ch.reason : undefined}
            onClick={() => { if (!ch.disabled) { setChannel(ch.id); setDraftId(null) } }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 h-auto rounded-lg text-xs font-semibold f-body border',
              channel === ch.id
                ? 'bg-accent text-white border-transparent'
                : ch.disabled
                  ? 'bg-white/7 text-white/20 border-white/10 cursor-not-allowed'
                  : 'bg-white/7 text-white/45 border-white/10 cursor-pointer',
            )}
          >
            {ch.icon}
            {ch.label}
          </Button>
        ))}
      </div>

      {/* Counterpart selector */}
      {guideAssigned && (
        <div className="flex gap-1.5">
          {(['angler', 'guide'] as const).map(cp => (
            <Button
              key={cp}
              type="button"
              onClick={() => { setCounterpart(cp); setDraftId(null) }}
              className={cn(
                'flex-1 h-auto py-1.5 rounded-lg text-xs font-semibold f-body capitalize border',
                counterpart === cp
                  ? 'bg-primary text-white border-white/20'
                  : 'bg-white/7 text-white/45 border-white/10',
              )}
            >
              {cp}
            </Button>
          ))}
        </div>
      )}

      {/* WhatsApp window-closed notice */}
      {channel === 'whatsapp' && !waAvailable && (
        <p className="text-xs f-body text-red-300">
          No phone number on record for this {counterpart}.
        </p>
      )}
      {channel === 'whatsapp' && waAvailable && isTemplatePath && (
        <div className="px-3 py-2.5 rounded-xl text-xs f-body bg-yellow-500/12 border border-yellow-500/25 text-yellow-200/85">
          24-hour window closed. Sending a pre-approved template.
        </div>
      )}

      {/* Instagram disabled notice */}
      {channel === 'instagram' && !igEnabled && (
        <p className="text-xs f-body text-white/[38%]">
          Instagram channel inactive — set INSTAGRAM_ACCESS_TOKEN to enable.
        </p>
      )}

      {/* Email subject (email only) */}
      {channel === 'email' && (
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block text-white/[38%]">
            Subject
          </label>
          <Input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Re: your inquiry…"
            className="bg-white/7 border-white/[12%] text-white placeholder:text-white/30 focus-visible:border-white/40"
          />
        </div>
      )}

      {/* Propose draft */}
      {!isTemplatePath && (
        <div>
          <Button
            type="button"
            onClick={handlePropose}
            disabled={draftPending}
            className="w-full flex items-center justify-center gap-1.5 h-auto py-2 rounded-xl text-xs font-semibold f-body bg-white/[6%] text-white/55 border border-white/10 disabled:cursor-not-allowed"
          >
            {draftPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {draftPending ? 'Drafting…' : 'Zaproponuj'}
          </Button>
          {draftError != null && (
            <p className="text-[11px] f-body mt-1 text-red-300">{draftError}</p>
          )}
        </div>
      )}

      {/* Message body — hidden for WA template path */}
      {!isTemplatePath && (
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block text-white/[38%]">
            Message
          </label>
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={'Hi Jan,\n\nThanks for your inquiry…'}
            className="min-h-[300px] resize-y bg-white/7 border-white/[12%] text-white placeholder:text-white/30 focus-visible:border-white/40"
          />
          {channel === 'whatsapp' && (
            <p className={cn(
              'text-[10px] f-body mt-1 text-right',
              body.length > 4096 ? 'text-red-300' : 'text-white/30',
            )}>
              {body.length}/4096
            </p>
          )}
        </div>
      )}

      {error != null && (
        <p className="text-xs f-body text-red-300">{error}</p>
      )}

      <Button
        type="button"
        onClick={handleSend}
        disabled={isPending || !canSend}
        className="w-full flex items-center justify-center gap-2 h-auto py-2.5 rounded-xl text-xs font-bold f-body bg-white/10 text-white border border-white/[12%] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending && <Loader2 size={12} className="animate-spin" />}
        {isPending
          ? 'Sending…'
          : isTemplatePath
            ? 'Send Template →'
            : 'Send Message →'}
      </Button>
    </div>
  )
}
