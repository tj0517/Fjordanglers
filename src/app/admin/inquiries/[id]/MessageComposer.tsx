'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, MessageSquare, Mail } from 'lucide-react'
import { sendMessageFromThread } from '@/actions/messages'

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
}) {
  const router = useRouter()

  const [channel,      setChannel]      = useState<Channel>('email')
  const [counterpart,  setCounterpart]  = useState<'angler' | 'guide'>('angler')
  const [subject,      setSubject]      = useState('')
  const [body,         setBody]         = useState('')
  const [isPending,    startTransition] = useTransition()
  const [error,        setError]        = useState<string | null>(null)
  const [sent,         setSent]         = useState(false)

  const waOpen = isWaWindowOpen(waLastInboundAt ?? null)

  // WA only available if the chosen counterpart has a phone
  const waAvailable = channel === 'whatsapp'
    ? (counterpart === 'angler' ? anglerHasPhone : guideHasPhone)
    : true

  function handleSend() {
    setError(null)
    startTransition(async () => {
      const res = await sendMessageFromThread(inquiryId, {
        channel,
        counterpart,
        subject: subject.trim() || undefined,
        body:    body.trim(),
      })
      if (res.success) {
        setSubject('')
        setBody('')
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
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
        style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
        <Check size={14} style={{ color: '#6EE7B7', flexShrink: 0 }} />
        <p className="text-sm font-semibold f-body" style={{ color: '#6EE7B7' }}>
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
    { id: 'instagram', label: 'Instagram', icon: <span style={{ fontSize: 11, fontWeight: 700 }}>IG</span>,
      disabled: !igEnabled, reason: 'Instagram not configured' },
  ]

  return (
    <div className="space-y-3">
      {/* Channel selector */}
      <div className="flex gap-1.5">
        {CHANNELS.map(ch => (
          <button
            key={ch.id}
            type="button"
            disabled={ch.disabled}
            title={ch.disabled ? ch.reason : undefined}
            onClick={() => { if (!ch.disabled) setChannel(ch.id) }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold f-body"
            style={{
              background: channel === ch.id ? '#E67E50'              : 'rgba(255,255,255,0.07)',
              color:      channel === ch.id ? '#fff'                  : ch.disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.45)',
              border:     channel === ch.id ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)',
              cursor:     ch.disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {ch.icon}
            {ch.label}
          </button>
        ))}
      </div>

      {/* Counterpart selector */}
      {guideAssigned && (
        <div className="flex gap-1.5">
          {(['angler', 'guide'] as const).map(cp => (
            <button
              key={cp}
              type="button"
              onClick={() => setCounterpart(cp)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold f-body capitalize"
              style={{
                background: counterpart === cp ? '#0A2E4D'             : 'rgba(255,255,255,0.07)',
                color:      counterpart === cp ? '#fff'                 : 'rgba(255,255,255,0.45)',
                border:     counterpart === cp ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {cp}
            </button>
          ))}
        </div>
      )}

      {/* WhatsApp window-closed notice */}
      {channel === 'whatsapp' && !waAvailable && (
        <p className="text-xs f-body" style={{ color: '#FCA5A5' }}>
          No phone number on record for this {counterpart}.
        </p>
      )}
      {channel === 'whatsapp' && waAvailable && isTemplatePath && (
        <div className="px-3 py-2.5 rounded-xl text-xs f-body"
          style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)', color: 'rgba(253,224,71,0.85)' }}>
          24-hour window closed. Sending a pre-approved template.
        </div>
      )}

      {/* Instagram disabled notice */}
      {channel === 'instagram' && !igEnabled && (
        <p className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.38)' }}>
          Instagram channel inactive — set INSTAGRAM_ACCESS_TOKEN to enable.
        </p>
      )}

      {/* Email subject (email only) */}
      {channel === 'email' && (
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block"
            style={{ color: 'rgba(255,255,255,0.38)' }}>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Re: your inquiry…"
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none placeholder:opacity-30"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#FFFFFF',
            }}
          />
        </div>
      )}

      {/* Message body — hidden for WA template path */}
      {!isTemplatePath && (
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block"
            style={{ color: 'rgba(255,255,255,0.38)' }}>Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={'Hi Jan,\n\nThanks for your inquiry…'}
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none resize-none placeholder:opacity-30"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#FFFFFF',
            }}
          />
        </div>
      )}

      {error != null && (
        <p className="text-xs f-body" style={{ color: '#FCA5A5' }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={isPending || !canSend}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body"
        style={{
          background: 'rgba(255,255,255,0.1)',
          color:      '#FFFFFF',
          border:     '1px solid rgba(255,255,255,0.12)',
          cursor:     isPending || !canSend ? 'not-allowed' : 'pointer',
          opacity:    !canSend ? 0.4 : 1,
        }}
      >
        {isPending && <Loader2 size={12} className="animate-spin" />}
        {isPending
          ? 'Sending…'
          : isTemplatePath
            ? 'Send Template →'
            : 'Send Message →'}
      </button>
    </div>
  )
}
