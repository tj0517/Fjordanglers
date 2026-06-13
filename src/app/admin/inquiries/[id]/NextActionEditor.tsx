'use client'

/**
 * NextActionEditor — quick "what to do next" reminder for an inquiry.
 * Internal only, no email. Saves to inquiries.next_action.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { updateNextAction } from '@/actions/inquiries'

interface Props {
  inquiryId:    string
  initialValue: string | null
}

export function NextActionEditor({ inquiryId, initialValue }: Props) {
  const router        = useRouter()
  const [pending, start] = useTransition()
  const [flash,  setFlash]  = useState(false)
  const [value,  setValue]  = useState(initialValue ?? '')

  function handleSave() {
    start(async () => {
      const res = await updateNextAction(inquiryId, value.trim() || null)
      if (res.success) {
        setFlash(true)
        setTimeout(() => setFlash(false), 3000)
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-[20px] overflow-hidden"
      style={{ background: 'rgba(10,46,77,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>

      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
          style={{ color: 'rgba(255,255,255,0.25)' }}>Next step</p>
        <p className="text-sm font-bold f-body mt-0.5" style={{ color: '#FFFFFF' }}>Next action</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {flash && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Check size={12} style={{ color: '#6EE7B7' }} />
            <p className="text-xs f-body font-semibold" style={{ color: '#6EE7B7' }}>Saved</p>
          </div>
        )}

        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="e.g. Call Tomasz Thursday to confirm dates…"
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl text-xs f-body outline-none resize-none placeholder:opacity-25"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border:     '1px solid rgba(255,255,255,0.1)',
            color:      '#FFFFFF',
          }}
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body transition-all"
          style={{
            background: 'rgba(255,255,255,0.08)',
            color:      pending ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
            border:     '1px solid rgba(255,255,255,0.1)',
            cursor:     pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
