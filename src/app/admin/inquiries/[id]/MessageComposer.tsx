'use client'

/**
 * MessageComposer — FA sends a plain-text email to the angler at any time.
 * Calls sendMessageToAngler() server action. Refreshes the page on success
 * so the correspondence thread in the left column updates.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check } from 'lucide-react'
import { sendMessageToAngler } from '@/actions/inquiries'

export function MessageComposer({ inquiryId }: { inquiryId: string }) {
  const router = useRouter()

  const [subject,    setSubject]    = useState('')
  const [body,       setBody]       = useState('')
  const [isPending,  startTransition] = useTransition()
  const [error,      setError]      = useState<string | null>(null)
  const [sent,       setSent]       = useState(false)

  function handleSend() {
    setError(null)
    startTransition(async () => {
      const res = await sendMessageToAngler(inquiryId, subject, body)
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
          Message sent to angler
        </p>
      </div>
    )
  }

  const canSend = subject.trim() !== '' && body.trim() !== ''

  return (
    <div className="space-y-3">
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
        {isPending ? 'Sending…' : 'Send Message →'}
      </button>
    </div>
  )
}
