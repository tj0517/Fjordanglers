'use client'

import { useState, useTransition } from 'react'
import { X, Plus, Check, Pencil } from 'lucide-react'
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
      <div
        className="flex items-start justify-between gap-4 py-3"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.14em] f-body flex-shrink-0"
          style={{ color: 'rgba(10,46,77,0.38)', minWidth: '110px' }}
        >
          Req. dates
        </span>

        <div className="flex-1 flex flex-wrap items-center gap-1.5 justify-end">
          {dates.length === 0 ? (
            <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>—</span>
          ) : (
            dates.map(d => (
              <span
                key={d}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs f-body font-medium"
                style={{
                  background: 'rgba(10,46,77,0.07)',
                  color: '#0A2E4D',
                  border: '1px solid rgba(10,46,77,0.1)',
                }}
              >
                {fmtDate(d)}
              </span>
            ))
          )}

          <button
            onClick={() => setEditing(true)}
            className="flex items-center justify-center w-5 h-5 rounded-full transition-all hover:bg-black/[0.07] flex-shrink-0"
            style={{ border: '1px solid rgba(10,46,77,0.15)' }}
            title="Edit dates"
          >
            <Pencil size={9} style={{ color: 'rgba(10,46,77,0.45)' }} />
          </button>
        </div>
      </div>
    )
  }

  // ── Edit view ──────────────────────────────────────────────────────────────
  return (
    <div
      className="py-3"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.14em] f-body block mb-2.5"
        style={{ color: 'rgba(10,46,77,0.38)' }}
      >
        Req. dates
      </span>

      {/* Date chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {dates.length === 0 ? (
          <span className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>No dates yet</span>
        ) : (
          dates.map(d => (
            <span
              key={d}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs f-body font-medium"
              style={{
                background: 'rgba(10,46,77,0.07)',
                color: '#0A2E4D',
                border: '1px solid rgba(10,46,77,0.12)',
              }}
            >
              {fmtDate(d)}
              <button
                onClick={() => removeDate(d)}
                className="flex items-center justify-center w-3.5 h-3.5 rounded-full transition-colors hover:bg-red-100 flex-shrink-0"
              >
                <X size={8} style={{ color: '#DC2626' }} />
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
          className="text-sm f-body px-2.5 py-1.5 rounded-[10px] outline-none"
          style={{
            background: 'rgba(10,46,77,0.04)',
            border: '1px solid rgba(10,46,77,0.12)',
            color: '#0A2E4D',
          }}
        />
        <button
          onClick={addDate}
          disabled={!newDate}
          className="flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-xs font-bold f-body transition-all"
          style={{
            background: newDate ? 'rgba(10,46,77,0.08)' : 'rgba(10,46,77,0.03)',
            color: newDate ? '#0A2E4D' : 'rgba(10,46,77,0.3)',
            border: '1px solid rgba(10,46,77,0.1)',
            cursor: newDate ? 'pointer' : 'default',
          }}
        >
          <Plus size={11} />
          Add
        </button>
      </div>

      {/* Error */}
      {error != null && (
        <p className="text-xs f-body mb-2" style={{ color: '#DC2626' }}>{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold f-body transition-all"
          style={{
            background: '#0A2E4D',
            color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Check size={11} />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 rounded-[10px] text-xs f-body transition-all hover:bg-black/[0.04]"
          style={{ color: 'rgba(10,46,77,0.5)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
