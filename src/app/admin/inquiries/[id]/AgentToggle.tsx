'use client'

import { useState, useTransition } from 'react'
import { setAgentStatus } from '@/actions/ai'
import { cn } from '@/lib/utils'

interface AgentToggleProps {
  inquiryId: string
  initialStatus: string | null
}

export function AgentToggle({ inquiryId, initialStatus }: AgentToggleProps) {
  const [status, setStatus] = useState(initialStatus ?? 'waiting')
  const [isPending, startTransition] = useTransition()

  const isStopped = status === 'stopped'

  function handleToggle() {
    const newStatus: 'waiting' | 'stopped' = isStopped ? 'waiting' : 'stopped'
    startTransition(async () => {
      const result = await setAgentStatus(inquiryId, newStatus)
      if (result.success) setStatus(newStatus)
    })
  }

  const statusLabel =
    status === 'waiting' ? 'Active' :
    status === 'ready'   ? 'Replied' :
                           'Stopped'

  return (
    <div className="rounded-[20px] overflow-hidden bg-[#FDFAF7] border border-primary/7">
      <div className="px-5 py-3.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body text-primary/[38%]">
            AI Agent
          </p>
          <span
            data-agent-status={status}
            className="agent-status-badge mt-1 inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold f-body"
          >
            {statusLabel}
          </span>
        </div>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={cn(
            'text-xs font-semibold f-body px-3 py-1.5 rounded-lg transition-all border disabled:opacity-50',
            isStopped
              ? 'bg-primary/7 text-primary border-primary/[12%]'
              : 'bg-red-500/10 text-red-800 border-red-500/20',
          )}
        >
          {isPending ? '…' : isStopped ? 'Restart agent' : 'Stop agent'}
        </button>
      </div>
    </div>
  )
}
