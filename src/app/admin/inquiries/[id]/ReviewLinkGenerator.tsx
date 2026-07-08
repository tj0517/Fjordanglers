'use client'

import { useState } from 'react'
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
      <div className="rounded-[18px] px-5 py-3.5"
        style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body mb-0.5"
          style={{ color: 'rgba(6,95,70,0.55)' }}>After trip · Review</p>
        <p className="text-sm font-semibold f-body" style={{ color: '#065F46' }}>✓ Review received</p>
        <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(6,95,70,0.55)' }}>
          {new Date(submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[18px] overflow-hidden"
      style={{ background: 'rgba(10,46,77,0.04)', border: '1px solid rgba(10,46,77,0.08)' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
          After trip
        </p>
        <p className="text-sm font-bold f-body mt-0.5" style={{ color: '#0A2E4D' }}>Review link</p>
      </div>

      <div className="px-5 py-3 space-y-2">
        {reviewUrl != null ? (
          <>
            <p className="text-[10px] f-body break-all" style={{ color: 'rgba(10,46,77,0.45)', fontFamily: 'monospace' }}>
              {reviewUrl}
            </p>
            <button
              onClick={handleCopy}
              className="w-full py-2 rounded-xl text-xs font-bold f-body transition-colors"
              style={{
                background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(10,46,77,0.08)',
                color: copied ? '#065F46' : '#0A2E4D',
              }}
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-2 rounded-xl text-xs font-bold f-body transition-all"
            style={{ background: '#E67E50', color: '#fff', opacity: loading ? 0.65 : 1 }}
          >
            {loading ? 'Generating…' : 'Generate review link'}
          </button>
        )}

        {err != null && (
          <p className="text-[11px] f-body" style={{ color: '#dc2626' }}>{err}</p>
        )}
      </div>
    </div>
  )
}
