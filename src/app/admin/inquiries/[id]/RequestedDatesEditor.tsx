'use client'

import { useState, useTransition } from 'react'
import { X, Plus, Check, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateRequestedDates } from '@/actions/inquiries'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  inquiryId: string
  initialDates: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RequestedDatesEditor({ inquiryId, initialDates }: Props) {
  const [editing,  setEditing ] = useState(false)
  const [dates,    setDates   ] = useState<string[]>(() =>
    [...initialDates].sort()
  )
  const [newDate,  setNewDate ] = useState('')
  const [error,    setError   ] = useState<string | null>(null)
  const [saving, startSave]    = useTransition()

  function addDate() {
    const d = newDate.trim()
    if (!d || dates.includes(d)) { setNewDate(''); return }
    setDates(prev => [...prev, d].sort())
    setNewDate('')
  }

  function removeDate(d: string) {
    setDates(prev => prev.filter(x => x !== d))
  }

  function handleSave() {
    startSave(async () => {
      setError(null)
      const res = await updateRequestedDates(inquiryId, dates)
      if (!res.success) {
        setError(res.error ?? 'Failed to save')
      } else {
        setEditing(false)
      }
    })
  }

  function handleCancel() {
    setDates([...initialDates].sort())
    setNewDate('')
    setError(null)
    setEditing(false)
  }

  // ── Read-only view ─────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4 py-3 border-b border-primary/[6%]">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] f-body flex-shrink-0 text-primary/[38%] min-w-[110px]">
          Req. dates
        </span>

        <div className="flex-1 flex flex-wrap items-center gap-1.5 justify-end">
          {dates.length === 0 ? (
            <span className="text-sm f-body text-primary/35">—</span>
          ) : (
            dates.map(d => (
              <span
                key={d}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs f-body font-medium bg-primary/7 text-primary border border-primary/10"
              >
                {fmtDate(d)}
              </span>
            ))
          )}

          <button
            onClick={() => setEditing(true)}
            className="flex items-center justify-center w-5 h-5 rounded-full transition-all hover:bg-black/7 flex-shrink-0 border border-primary/15"
            title="Edit dates"
          >
            <Pencil size={9} className="text-primary/45" />
          </button>
        </div>
      </div>
    )
  }

  // ── Edit view ──────────────────────────────────────────────────────────────
  return (
    <div className="py-3 border-b border-primary/[6%]">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] f-body block mb-2.5 text-primary/[38%]">
        Req. dates
      </span>

      {/* Date chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {dates.length === 0 ? (
          <span className="text-xs f-body text-primary/35">No dates yet</span>
        ) : (
          dates.map(d => (
            <span
              key={d}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs f-body font-medium bg-primary/7 text-primary border border-primary/[12%]"
            >
              {fmtDate(d)}
              <button
                onClick={() => removeDate(d)}
                className="flex items-center justify-center w-3.5 h-3.5 rounded-full transition-colors hover:bg-red-100 flex-shrink-0"
              >
                <X size={8} className="text-red-600" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Add date row */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="date"
          value={newDate}
          onChange={e => setNewDate(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addDate()}
          className="text-sm f-body px-2.5 py-1.5 rounded-[10px] outline-none bg-primary/[4%] border border-primary/[12%] text-primary"
        />
        <button
          onClick={addDate}
          disabled={!newDate}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-xs font-bold f-body transition-all border border-primary/10',
            newDate
              ? 'bg-primary/[8%] text-primary cursor-pointer'
              : 'bg-primary/3 text-primary/30 cursor-default',
          )}
        >
          <Plus size={11} />
          Add
        </button>
      </div>

      {/* Error */}
      {error != null && (
        <p className="text-xs f-body mb-2 text-red-600">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold f-body transition-all bg-primary text-primary-foreground disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <Check size={11} />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 rounded-[10px] text-xs f-body transition-all hover:bg-black/[4%] text-primary/50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
