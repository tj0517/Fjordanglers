'use client'

import { useTransition, useState } from 'react'
import { setKnowledgeActive } from '@/actions/knowledge'

export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setError(null)
    startTransition(async () => {
      const result = await setKnowledgeActive(id, !active)
      if (!result.success) setError(result.error)
    })
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={isPending}
        className="text-xs font-medium px-3 py-1.5 rounded-xl f-body transition-all hover:brightness-90 disabled:opacity-60"
        style={{
          background: active ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.1)',
          color:      active ? '#DC2626' : '#16A34A',
        }}
      >
        {isPending ? '…' : active ? 'Deactivate' : 'Activate'}
      </button>
      {error != null && (
        <p className="text-[11px] f-body mt-1" style={{ color: '#DC2626' }}>{error}</p>
      )}
    </div>
  )
}
