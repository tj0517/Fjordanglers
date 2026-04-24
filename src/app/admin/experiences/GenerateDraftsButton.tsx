'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Wand2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { generateExperienceDrafts, type GenerateDraftsResult } from '@/actions/experience-pages'

export function GenerateDraftsButton() {
  const router                    = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult]       = useState<GenerateDraftsResult | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await generateExperienceDrafts()
      setResult(res)
      if (res.created > 0) router.refresh()
    })
  }

  const hasResult = result != null
  const allGood   = hasResult && result.errors.length === 0

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full transition-all hover:brightness-110 f-body disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D', border: '1px solid rgba(10,46,77,0.12)' }}
      >
        {isPending
          ? <Loader2 size={13} strokeWidth={2} className="animate-spin" />
          : <Wand2 size={13} strokeWidth={2} />
        }
        {isPending ? 'Generating…' : 'Generate Drafts from Trips'}
      </button>

      {/* Result banner */}
      {hasResult && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-2xl text-xs f-body max-w-[340px] text-right"
          style={{
            background: allGood ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.08)',
            border:     allGood ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(239,68,68,0.15)',
            color:      allGood ? '#166534' : '#991B1B',
          }}
        >
          {allGood
            ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
            : <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          }
          <div>
            {result.created > 0 && (
              <p className="font-semibold">
                {result.created} draft{result.created !== 1 ? 's' : ''} created
              </p>
            )}
            {result.skipped > 0 && (
              <p style={{ opacity: 0.7 }}>
                {result.skipped} trip{result.skipped !== 1 ? 's' : ''} already had a page — skipped
              </p>
            )}
            {result.created === 0 && result.skipped === 0 && result.errors.length === 0 && (
              <p>No published trips found</p>
            )}
            {result.errors.length > 0 && (
              <p className="font-semibold mt-0.5">{result.errors.length} error{result.errors.length !== 1 ? 's' : ''}:</p>
            )}
            {result.errors.map((e, i) => (
              <p key={i} className="mt-0.5 opacity-80">{e}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
