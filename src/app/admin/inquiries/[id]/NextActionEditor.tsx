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
    <div className="rounded-[20px] overflow-hidden bg-primary/35 border border-white/[6%]">

      <div className="px-5 py-3.5 border-b border-white/[6%]">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body text-white/25">
          Next step
        </p>
        <p className="text-sm font-bold f-body mt-0.5 text-white">Next action</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {flash && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
            <Check size={12} className="text-emerald-300" />
            <p className="text-xs f-body font-semibold text-emerald-300">Saved</p>
          </div>
        )}

        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="e.g. Call Tomasz Thursday to confirm dates…"
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl text-xs f-body outline-none resize-none placeholder:opacity-25 bg-white/[6%] border border-white/10 text-white"
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body transition-all bg-white/[8%] border border-white/10 text-white/70 disabled:text-white/30 disabled:cursor-not-allowed"
        >
          {pending && <Loader2 size={12} className="animate-spin" />}
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
