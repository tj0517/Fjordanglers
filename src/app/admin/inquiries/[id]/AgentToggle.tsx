'use client'

import { useState, useTransition } from 'react'
import { setAgentStatus } from '@/actions/ai'

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
  const statusColor =
    status === 'stopped' ? '#991B1B' :
    status === 'ready'   ? '#065F46' :
                           '#1E40AF'
  const statusBg =
    status === 'stopped' ? 'rgba(239,68,68,0.10)' :
    status === 'ready'   ? 'rgba(16,185,129,0.12)' :
                           'rgba(59,130,246,0.12)'

  return (
    <div className="rounded-[20px] overflow-hidden"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
      <div className="px-5 py-3.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] f-body"
            style={{ color: 'rgba(10,46,77,0.38)' }}>AI Agent</p>
          <span className="mt-1 inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold f-body"
            style={{ background: statusBg, color: statusColor }}>
            {statusLabel}
          </span>
        </div>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className="text-xs font-semibold f-body px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
          style={isStopped
            ? { background: 'rgba(10,46,77,0.07)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.12)' }
            : { background: 'rgba(239,68,68,0.10)', color: '#991B1B', border: '1px solid rgba(239,68,68,0.2)' }
          }
        >
          {isPending ? '…' : isStopped ? 'Restart agent' : 'Stop agent'}
        </button>
      </div>
    </div>
  )
}
