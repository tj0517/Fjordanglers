'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { generateReviewLink } from '@/actions/reviews'

interface Props {
  inquiryId: string
  existingToken: string | null
  existingBaseUrl: string
  submittedAt: string | null
}

export function ReviewLinkGenerator({ inquiryId, existingToken, existingBaseUrl, submittedAt }: Props) {
  const [token, setToken] = useState<string | null>(existingToken)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const reviewUrl = token != null ? `${existingBaseUrl}/reviews/${token}` : null

  async function handleGenerate() {
    setLoading(true)
    setErr(null)
    try {
      const result = await generateReviewLink(inquiryId)
      setToken(result.token)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to generate link.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (reviewUrl == null) return
    await navigator.clipboard.writeText(reviewUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Already submitted
  if (submittedAt != null) {
    return (
      <div className="rounded-[18px] px-5 py-3.5 bg-emerald-500/[7%] border border-emerald-500/[18%]">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-0.5 text-emerald-900/55">
          After trip · Review
        </p>
        <p className="text-sm font-semibold f-body text-emerald-800">✓ Review received</p>
        <p className="text-[11px] f-body mt-0.5 text-emerald-900/55">
          {new Date(submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[18px] overflow-hidden bg-primary/[4%] border border-primary/[8%]">
      <div className="px-5 py-3 border-b border-primary/[7%]">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body text-primary/35">
          After trip
        </p>
        <p className="text-sm font-bold f-body mt-0.5 text-primary">Review link</p>
      </div>

      <div className="px-5 py-3 space-y-2">
        {reviewUrl != null ? (
          <>
            <p className="text-[10px] f-body break-all text-primary/45 font-mono">
              {reviewUrl}
            </p>
            <button
              onClick={handleCopy}
              className={cn(
                'w-full py-2 rounded-xl text-xs font-bold f-body transition-colors',
                copied
                  ? 'bg-emerald-500/12 text-emerald-800'
                  : 'bg-primary/[8%] text-primary',
              )}
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-2 rounded-xl text-xs font-bold f-body transition-all bg-accent text-white disabled:opacity-65"
          >
            {loading ? 'Generating…' : 'Generate review link'}
          </button>
        )}

        {err != null && (
          <p className="text-[11px] f-body text-red-600">{err}</p>
        )}
      </div>
    </div>
  )
}
