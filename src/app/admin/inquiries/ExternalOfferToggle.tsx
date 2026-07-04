'use client'

import { useState, useTransition } from 'react'
import { setExternalOffer } from '@/actions/inquiries'

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
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold f-body transition-all mt-0.5"
      style={{
        background: active ? 'rgba(16,185,129,0.1)'           : 'rgba(10,46,77,0.05)',
        color:      active ? '#065F46'                         : 'rgba(10,46,77,0.45)',
        border:     active ? '1px solid rgba(16,185,129,0.28)' : '1px solid rgba(10,46,77,0.1)',
        cursor:     pending ? 'default' : 'pointer',
        opacity:    pending ? 0.6 : 1,
      }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
        background: active ? '#10B981' : 'rgba(10,46,77,0.15)',
        color: '#fff', fontSize: 8, fontWeight: 800,
      }}>
        {active ? '✓' : ''}
      </span>
      {active ? 'Ext. offer sent' : 'Offer done externally?'}
    </button>
  )
}
