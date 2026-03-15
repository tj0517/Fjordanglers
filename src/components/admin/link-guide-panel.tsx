'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { linkGuideAccount } from '@/actions/admin'

type Props = {
  guideId: string
}

/**
 * Action-row button that links a guide listing to an existing auth account.
 *
 * Admin enters either:
 *   - an email address  →  server scans auth users by email
 *   - a user UUID       →  server uses it directly (getUserById)
 *
 * Shows as a compact button in the guide detail actions row.
 * On click, expands an inline input below — no modal, no navigation.
 */
export default function LinkGuidePanel({ guideId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [result, setResult] = useState<'idle' | 'success' | { error: string }>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setResult('idle')

    startTransition(async () => {
      const res = await linkGuideAccount(guideId, value.trim())
      if ('error' in res) {
        setResult({ error: res.error })
      } else {
        setResult('success')
        router.refresh()
      }
    })
  }

  // Success — show confirmation, no further interaction needed
  if (result === 'success') {
    return (
      <div
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full f-body"
        style={{ background: 'rgba(74,222,128,0.12)', color: '#16A34A' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2">
          <polyline points="2,6.5 4.5,9 10,3" />
        </svg>
        Account linked
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle button */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full transition-all f-body hover:brightness-95"
          style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
        >
          {/* Chain link icon */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4.5 7.5a3 3 0 004.2 0l1.3-1.3a3 3 0 00-4.2-4.2L5 2.8" strokeLinecap="round" />
            <path d="M7.5 4.5a3 3 0 00-4.2 0L2 5.8a3 3 0 004.2 4.2L7 9.2" strokeLinecap="round" />
          </svg>
          Link account
        </button>
      ) : (
        /* Inline form */
        <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Email or user UUID"
            disabled={isPending}
            className="text-xs f-body outline-none transition-all"
            style={{
              width: '220px',
              background: 'rgba(10,46,77,0.05)',
              border: '1.5px solid rgba(10,46,77,0.15)',
              borderRadius: '10px',
              padding: '7px 12px',
              color: '#0A2E4D',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.15)' }}
          />

          <button
            type="submit"
            disabled={isPending || !value.trim()}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed f-body text-white"
            style={{ background: '#0A2E4D' }}
          >
            {isPending ? (
              <>
                <svg className="animate-spin" width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="5.5" cy="5.5" r="4" strokeOpacity="0.3" />
                  <path d="M5.5 1.5a4 4 0 014 4" strokeLinecap="round" />
                </svg>
                Linking…
              </>
            ) : 'Link'}
          </button>

          <button
            type="button"
            onClick={() => { setOpen(false); setValue(''); setResult('idle') }}
            disabled={isPending}
            className="text-xs f-body transition-colors hover:text-[#0A2E4D] disabled:opacity-50"
            style={{ color: 'rgba(10,46,77,0.38)' }}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Inline error */}
      {typeof result === 'object' && (
        <p className="text-[11px] f-body" style={{ color: '#DC2626' }}>
          {result.error}
        </p>
      )}
    </div>
  )
}
