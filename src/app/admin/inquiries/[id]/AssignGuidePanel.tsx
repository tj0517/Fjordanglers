'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { assignGuideToInquiry } from '@/actions/inquiries'

interface Props {
  inquiryId: string
  currentAssignedGuideId: string | null
  guides: { id: string; full_name: string }[]
}

export function AssignGuidePanel({ inquiryId, currentAssignedGuideId, guides }: Props) {
  const router             = useRouter()
  const [pending, start]   = useTransition()
  const [selected, setSelected] = useState(currentAssignedGuideId ?? '')
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  function handleAssign() {
    if (selected === '' || selected === currentAssignedGuideId) return
    setSuccess(false)
    setError(null)
    start(async () => {
      const res = await assignGuideToInquiry(inquiryId, selected)
      if (res.success) {
        setSuccess(true)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div
      className="rounded-[20px] overflow-hidden"
      style={{ background: 'rgba(10,46,77,0.55)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
          style={{ color: 'rgba(255,255,255,0.28)' }}>Guide assignment</p>
        <p className="text-sm font-bold f-body mt-0.5" style={{ color: '#FFFFFF' }}>Assign guide</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        <select
          value={selected}
          onChange={e => { setSelected(e.target.value); setSuccess(false) }}
          disabled={pending}
          className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border:     '1px solid rgba(255,255,255,0.12)',
            color:      selected === '' ? 'rgba(255,255,255,0.35)' : '#FFFFFF',
          }}
        >
          <option value="" style={{ background: '#0A2E4D', color: 'rgba(255,255,255,0.5)' }}>
            — Unassigned —
          </option>
          {guides.map(g => (
            <option key={g.id} value={g.id} style={{ background: '#0A2E4D', color: '#FFFFFF' }}>
              {g.full_name}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={pending || selected === '' || selected === currentAssignedGuideId}
          onClick={handleAssign}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold f-body transition-all"
          style={{
            background: 'rgba(230,126,80,0.22)',
            color:      '#E67E50',
            border:     '1px solid rgba(230,126,80,0.35)',
            opacity:    (pending || selected === '' || selected === currentAssignedGuideId) ? 0.5 : 1,
            cursor:     (pending || selected === '' || selected === currentAssignedGuideId) ? 'default' : 'pointer',
          }}
        >
          {pending && <Loader2 size={13} className="animate-spin" />}
          Assign &amp; Notify Guide
        </button>

        {success && (
          <p className="text-[10px] f-body text-center" style={{ color: '#6EE7B7' }}>
            ✅ Guide assigned — email sent
          </p>
        )}
        {error != null && (
          <p className="text-[10px] f-body" style={{ color: '#FCA5A5' }}>{error}</p>
        )}
      </div>
    </div>
  )
}
