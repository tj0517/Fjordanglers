'use client'

/**
 * InquiriesFilters — client component for search + date range.
 * Updates URL search params on the fly; the Server Component page re-renders
 * with the new params to apply filters server-side.
 */

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'
import { Search, X, CalendarDays, Loader2 } from 'lucide-react'

export function InquiriesFilters() {
  const searchParams   = useSearchParams()
  const router         = useRouter()
  const pathname       = usePathname()
  const [isPending, startTransition] = useTransition()

  const currentQ    = searchParams.get('q')    ?? ''
  const currentFrom = searchParams.get('from') ?? ''
  const currentTo   = searchParams.get('to')   ?? ''

  const [localQ, setLocalQ] = useState(currentQ)

  // Keep localQ in sync when URL changes externally
  useEffect(() => {
    setLocalQ(searchParams.get('q') ?? '')
  }, [searchParams])

  function pushParams(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v)
      else   params.delete(k)
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function commitSearch(value: string) {
    pushParams({ q: value.trim() })
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    params.delete('from')
    params.delete('to')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const hasFilters = currentQ !== '' || currentFrom !== '' || currentTo !== ''

  return (
    <div className="flex flex-wrap gap-2 items-center">

      {/* ─── Search ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-[14px] flex-1"
        style={{
          background: '#FDFAF7',
          border:     `1px solid ${currentQ ? 'rgba(10,46,77,0.25)' : 'rgba(10,46,77,0.1)'}`,
          minWidth:   '200px',
          maxWidth:   '320px',
        }}
      >
        {isPending
          ? <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: '#E67E50' }} />
          : <Search   size={13} style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }} />
        }
        <input
          type="text"
          value={localQ}
          onChange={e => setLocalQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitSearch(localQ)
            if (e.key === 'Escape') { setLocalQ(''); commitSearch('') }
          }}
          onBlur={() => commitSearch(localQ)}
          placeholder="Search name or email…"
          className="flex-1 bg-transparent outline-none text-sm f-body placeholder:opacity-40"
          style={{ color: '#0A2E4D', minWidth: 0 }}
        />
        {localQ && (
          <button
            type="button"
            onClick={() => { setLocalQ(''); commitSearch('') }}
            className="flex-shrink-0 p-0.5 rounded-full transition-opacity hover:opacity-70"
          >
            <X size={11} style={{ color: 'rgba(10,46,77,0.45)' }} />
          </button>
        )}
      </div>

      {/* ─── Date from ──────────────────────────────────────── */}
      <label
        className="flex items-center gap-2 px-3 py-2 rounded-[14px] cursor-pointer"
        style={{
          background: '#FDFAF7',
          border:     `1px solid ${currentFrom ? 'rgba(10,46,77,0.25)' : 'rgba(10,46,77,0.1)'}`,
        }}
      >
        <CalendarDays size={13} style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }} />
        <span className="text-[10px] font-bold f-body uppercase tracking-[0.1em]"
          style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }}>
          From
        </span>
        <input
          type="date"
          value={currentFrom}
          onChange={e => pushParams({ from: e.target.value })}
          className="bg-transparent outline-none text-sm f-body"
          style={{ color: currentFrom ? '#0A2E4D' : 'rgba(10,46,77,0.35)' }}
        />
        {currentFrom && (
          <button
            type="button"
            onClick={e => { e.preventDefault(); pushParams({ from: '' }) }}
            className="flex-shrink-0"
          >
            <X size={11} style={{ color: 'rgba(10,46,77,0.45)' }} />
          </button>
        )}
      </label>

      {/* ─── Date to ────────────────────────────────────────── */}
      <label
        className="flex items-center gap-2 px-3 py-2 rounded-[14px] cursor-pointer"
        style={{
          background: '#FDFAF7',
          border:     `1px solid ${currentTo ? 'rgba(10,46,77,0.25)' : 'rgba(10,46,77,0.1)'}`,
        }}
      >
        <CalendarDays size={13} style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }} />
        <span className="text-[10px] font-bold f-body uppercase tracking-[0.1em]"
          style={{ color: 'rgba(10,46,77,0.35)', flexShrink: 0 }}>
          To
        </span>
        <input
          type="date"
          value={currentTo}
          onChange={e => pushParams({ to: e.target.value })}
          className="bg-transparent outline-none text-sm f-body"
          style={{ color: currentTo ? '#0A2E4D' : 'rgba(10,46,77,0.35)' }}
        />
        {currentTo && (
          <button
            type="button"
            onClick={e => { e.preventDefault(); pushParams({ to: '' }) }}
            className="flex-shrink-0"
          >
            <X size={11} style={{ color: 'rgba(10,46,77,0.45)' }} />
          </button>
        )}
      </label>

      {/* ─── Clear all ──────────────────────────────────────── */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-xs font-semibold f-body transition-all hover:opacity-80"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color:      '#DC2626',
            border:     '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <X size={11} />
          Clear
        </button>
      )}
    </div>
  )
}
