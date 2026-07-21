'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteInquiry } from '@/actions/inquiries'

interface Props {
  inquiryId:  string
  anglerName: string
}

export function DeleteInquiryButton({ inquiryId, anglerName }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error,      setError     ] = useState<string | null>(null)
  const [deleting, startDelete]    = useTransition()

  function handleDelete() {
    startDelete(async () => {
      setError(null)
      const res = await deleteInquiry(inquiryId)
      if (!res.success) {
        setError(res.error ?? 'Failed to delete')
        setConfirming(false)
      } else {
        router.push('/admin/inquiries')
      }
    })
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[12px] text-xs font-semibold f-body transition-all hover:opacity-90"
        style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.18)' }}
      >
        <Trash2 size={12} />
        Delete inquiry
      </button>
    )
  }

  return (
    <div
      className="rounded-[16px] p-4"
      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
    >
      <p className="text-xs font-bold f-body mb-1" style={{ color: '#DC2626' }}>
        Permanently delete?
      </p>
      <p className="text-[11px] f-body mb-3 leading-relaxed" style={{ color: 'rgba(153,27,27,0.7)' }}>
        <strong>{anglerName}</strong> and all associated messages, notes, and data will be gone forever.
      </p>

      {error != null && (
        <p className="text-[11px] f-body mb-2" style={{ color: '#DC2626' }}>{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 py-1.5 rounded-[10px] text-xs font-bold f-body transition-all"
          style={{
            background: '#DC2626',
            color: '#fff',
            opacity: deleting ? 0.65 : 1,
            cursor: deleting ? 'not-allowed' : 'pointer',
          }}
        >
          {deleting ? 'Deleting…' : 'Yes, delete forever'}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={deleting}
          className="px-3 py-1.5 rounded-[10px] text-xs f-body transition-all hover:bg-black/[0.05]"
          style={{ color: 'rgba(10,46,77,0.5)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
