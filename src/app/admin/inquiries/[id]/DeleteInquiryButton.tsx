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
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[12px] text-xs font-semibold f-body transition-all hover:opacity-90 bg-red-500/[7%] text-red-600 border border-red-500/[18%]"
      >
        <Trash2 size={12} />
        Delete inquiry
      </button>
    )
  }

  return (
    <div className="rounded-[16px] p-4 bg-red-500/[6%] border border-red-500/20">
      <p className="text-xs font-bold f-body mb-1 text-red-600">
        Permanently delete?
      </p>
      <p className="text-[11px] f-body mb-3 leading-relaxed text-red-800/70">
        <strong>{anglerName}</strong> and all associated messages, notes, and data will be gone forever.
      </p>

      {error != null && (
        <p className="text-[11px] f-body mb-2 text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 py-1.5 rounded-[10px] text-xs font-bold f-body transition-all bg-red-600 text-white disabled:opacity-65 disabled:cursor-not-allowed"
        >
          {deleting ? 'Deleting…' : 'Yes, delete forever'}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={deleting}
          className="px-3 py-1.5 rounded-[10px] text-xs f-body transition-all hover:bg-black/5 text-primary/50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
