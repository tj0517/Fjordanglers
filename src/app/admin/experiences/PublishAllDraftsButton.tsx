'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Rocket, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { publishAllDrafts } from '@/actions/experience-pages'

export function PublishAllDraftsButton({ draftCount }: { draftCount: number }) {
  const router                       = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult]          = useState<{ published: number; error?: string } | null>(null)

  if (draftCount === 0) return null

  function handleClick() {
    if (!confirm(`Publish all ${draftCount} draft${draftCount !== 1 ? 's' : ''} to live? This makes them publicly visible.`)) return
    setResult(null)
    startTransition(async () => {
      const res = await publishAllDrafts()
      setResult(res)
      if (res.published > 0) router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full transition-all hover:brightness-110 f-body disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: 'rgba(22,163,74,0.1)', color: '#166534', border: '1px solid rgba(22,163,74,0.2)' }}
      >
        {isPending
          ? <Loader2 size={13} strokeWidth={2} className="animate-spin" />
          : <Rocket size={13} strokeWidth={2} />
        }
        {isPending ? 'Publishing…' : `Publish All Drafts (${draftCount})`}
      </button>

      {result != null && (
        <div
          className="flex items-start gap-2 px-4 py-2.5 rounded-2xl text-xs f-body"
          style={{
            background: result.error ? 'rgba(239,68,68,0.08)' : 'rgba(74,222,128,0.1)',
            border:     result.error ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(74,222,128,0.2)',
            color:      result.error ? '#991B1B' : '#166534',
          }}
        >
          {result.error
            ? <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            : <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />
          }
          <span className="font-semibold">
            {result.error
              ? `Error: ${result.error}`
              : `${result.published} page${result.published !== 1 ? 's' : ''} are now live`
            }
          </span>
        </div>
      )}
    </div>
  )
}
