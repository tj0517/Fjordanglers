'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminSetGuideStatus } from '@/actions/admin'

export function QuickApproveButton({ guideId }: { guideId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleApprove() {
    setLoading(true)
    await adminSetGuideStatus(guideId, 'active')
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={() => { void handleApprove() }}
      disabled={loading}
      className="f-body"
      style={{
        background: 'rgba(22,163,74,0.12)',
        color: '#16A34A',
        border: '1px solid rgba(22,163,74,0.25)',
        borderRadius: '8px',
        padding: '3px 8px',
        fontSize: '10px',
        fontWeight: 700,
        fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? '…' : '✓ Approve'}
    </button>
  )
}
