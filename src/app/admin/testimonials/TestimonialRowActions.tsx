'use client'

import { useTransition, useState } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { setTestimonialActive, moveTestimonial } from '@/actions/testimonials'

export function TestimonialRowActions({
  id,
  active,
  isFirst,
  isLast,
}: {
  id: string
  active: boolean
  isFirst: boolean
  isLast: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<{ success: true } | { success: false; error: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.success) setError(result.error)
    })
  }

  const arrowStyle = { background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }

  return (
    <div className="max-w-[220px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => run(() => moveTestimonial(id, 'up'))}
          disabled={isPending || isFirst}
          aria-label="Move up"
          className="p-1.5 rounded-xl transition-all hover:brightness-90 disabled:opacity-30"
          style={arrowStyle}
        >
          <ArrowUp size={13} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => run(() => moveTestimonial(id, 'down'))}
          disabled={isPending || isLast}
          aria-label="Move down"
          className="p-1.5 rounded-xl transition-all hover:brightness-90 disabled:opacity-30"
          style={arrowStyle}
        >
          <ArrowDown size={13} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => run(() => setTestimonialActive(id, !active))}
          disabled={isPending}
          className="text-xs font-medium px-3 py-1.5 rounded-xl f-body transition-all hover:brightness-90 disabled:opacity-60"
          style={{
            background: active ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.1)',
            color:      active ? '#DC2626' : '#16A34A',
          }}
        >
          {isPending ? '…' : active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
      {error != null && (
        <p role="alert" className="text-[11px] f-body mt-1" style={{ color: '#DC2626' }}>{error}</p>
      )}
    </div>
  )
}
