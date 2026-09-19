'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { setInquiryQualified } from '@/actions/inquiries'
import type { QualifiedValue } from '@/lib/inquiries/qualified'

const OPTIONS: { value: QualifiedValue; label: string; color: string; bg: string; border: string }[] = [
  { value: 'yes',     label: 'Yes',          color: '#065F46', bg: 'rgba(16,185,129,0.18)',  border: 'rgba(16,185,129,0.35)'  },
  { value: 'no',      label: 'No',           color: '#991B1B', bg: 'rgba(239,68,68,0.18)',   border: 'rgba(239,68,68,0.35)'   },
  { value: 'unknown', label: 'Reset to auto', color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)'  },
]

export function QualifiedChanger({
  inquiryId,
  currentValue,
  setBy,
}: {
  inquiryId:    string
  currentValue: QualifiedValue
  setBy:        string | null
}) {
  const router          = useRouter()
  const [pending, start] = useTransition()

  function handleClick(value: QualifiedValue) {
    if (value === currentValue) return
    start(async () => {
      await setInquiryQualified(inquiryId, value)
      router.refresh()
    })
  }

  const current = OPTIONS.find(o => o.value === currentValue) ?? OPTIONS[2]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Qualified
        </span>
        {setBy != null && (
          <span style={{ fontSize: 11, color: '#6B7280' }}>
            (set by {setBy})
          </span>
        )}
        {pending && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: '#6B7280' }} />}
      </div>

      <div
        style={{
          display: 'inline-flex',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          color: current.color,
          background: current.bg,
          border: `1px solid ${current.border}`,
          marginBottom: 6,
        }}
      >
        {currentValue === 'unknown' ? 'Auto (unknown)' : current.label}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {OPTIONS.filter(o => o.value !== currentValue).map(opt => (
          <button
            key={opt.value}
            onClick={() => handleClick(opt.value)}
            disabled={pending}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: pending ? 'not-allowed' : 'pointer',
              color: opt.color,
              background: opt.bg,
              border: `1px solid ${opt.border}`,
              opacity: pending ? 0.5 : 1,
              textAlign: 'left',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
