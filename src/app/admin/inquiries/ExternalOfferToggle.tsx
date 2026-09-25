'use client'

import { useState, useTransition } from 'react'
import { setExternalOffer } from '@/actions/inquiries'
import { cn } from '@/lib/utils'

export function ExternalOfferToggle({
  inquiryId,
  initial,
}: {
  inquiryId: string
  initial:   boolean
}) {
  const [active, setActive]   = useState(initial)
  const [pending, start]      = useTransition()

  function toggle(e: React.MouseEvent) {
    e.preventDefault()   // don't follow the parent <Link>
    e.stopPropagation()
    const next = !active
    setActive(next)
    start(async () => {
      const res = await setExternalOffer(inquiryId, next)
      if (!res.success) setActive(!next)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold f-body transition-all mt-0.5 border',
        active
          ? 'bg-emerald-500/10 text-emerald-900 border-emerald-500/[28%]'
          : 'bg-primary/5 text-primary/45 border-primary/10',
        pending && 'opacity-60 cursor-default',
      )}
    >
      <span className={cn(
        'inline-flex items-center justify-center w-3 h-3 rounded-[3px] flex-shrink-0 text-white text-[8px] font-extrabold',
        active ? 'bg-emerald-500' : 'bg-primary/15',
      )}>
        {active ? '✓' : ''}
      </span>
      {active ? 'Ext. offer sent' : 'Offer done externally?'}
    </button>
  )
}
