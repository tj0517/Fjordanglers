'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * A month calendar for picking 1–`max` days, from `earliest` on. Convenience only — the
 * server validates count, format and "after today in the trip country" again.
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS_AHEAD = 24

/** 0 … n-1 */
function range(n: number): number[] {
  return [...Array(n).keys()]
}

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)
}

function monthIndex(isoDate: string): number {
  const [y, m] = isoDate.split('-').map(Number)
  return y * 12 + (m - 1)
}

export function DatePicker({
  earliest, selected, max, onToggle,
}: {
  earliest: string
  selected: readonly string[]
  max: number
  onToggle: (date: string) => void
}) {
  const first = monthIndex(earliest)
  const [shown, setShown] = useState(selected.length > 0 ? monthIndex([...selected].sort()[0]) : first)
  const year = Math.floor(shown / 12)
  const month = shown % 12

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7   // Monday first
  const full = selected.length >= max
  const title = new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

  return (
    <div className="rounded-2xl p-3" style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.1)' }} data-testid="date-picker">
      <div className="flex items-center justify-between mb-2">
        <button type="button" aria-label="Previous month" disabled={shown <= first}
          onClick={() => setShown(s => s - 1)}
          className="w-11 h-11 flex items-center justify-center rounded-full disabled:opacity-25"
          style={{ color: '#0A2E4D' }}>
          <ChevronLeft size={20} />
        </button>
        <p className="text-base font-semibold f-body" style={{ color: '#0A2E4D' }}>{title}</p>
        <button type="button" aria-label="Next month" disabled={shown >= first + MONTHS_AHEAD}
          onClick={() => setShown(s => s + 1)}
          className="w-11 h-11 flex items-center justify-center rounded-full disabled:opacity-25"
          style={{ color: '#0A2E4D' }}>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs f-body mb-1" style={{ color: 'rgba(10,46,77,0.5)' }}>
        {WEEKDAYS.map(w => <span key={w} className="py-1">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {range(lead).map(i => <span key={`lead-${i}`} />)}
        {range(daysInMonth).map(i => {
          const date = iso(year, month, i + 1)
          const isSelected = selected.includes(date)
          const disabled = date < earliest || (full && !isSelected)
          return (
            <button key={date} type="button" disabled={disabled} aria-pressed={isSelected}
              aria-label={date} onClick={() => onToggle(date)}
              className="h-11 rounded-xl text-sm f-body font-medium disabled:opacity-25"
              style={isSelected
                ? { background: '#0A2E4D', color: '#fff' }
                : { background: 'rgba(10,46,77,0.04)', color: '#0A2E4D' }}>
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
