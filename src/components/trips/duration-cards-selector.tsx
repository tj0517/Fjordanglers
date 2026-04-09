'use client'

/**
 * DurationCardsSelector — interactive "Choose your duration" section
 * in the experience detail main content.
 *
 * Clicking a card updates the shared BookingStateContext so the right-column
 * BookingWidget instantly reflects the selection (and vice-versa).
 */

import { useMemo } from 'react'
import type { DurationOptionPayload } from '@/actions/experiences'
import { useBookingState } from '@/contexts/booking-context'
import { Check } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priceLabel(opt: DurationOptionPayload): { str: string; hint: string } {
  if (opt.pricing_type === 'per_boat') {
    return { str: `€${opt.price_eur}`, hint: 'flat rate · whole boat' }
  }
  if (opt.pricing_type === 'per_group' && opt.group_prices != null) {
    const vals = Object.values(opt.group_prices).filter((v): v is number => typeof v === 'number')
    const min  = vals.length > 0 ? Math.min(...vals) : opt.price_eur
    return { str: `From €${min}`, hint: 'price by group size' }
  }
  return { str: `€${opt.price_eur}`, hint: 'per person' }
}

function durationStr(opt: DurationOptionPayload): string | null {
  const parts: string[] = []
  if (opt.hours != null) parts.push(`${opt.hours}h`)
  if (opt.days  != null) parts.push(`${opt.days} ${opt.days === 1 ? 'day' : 'days'}`)
  return parts.join(' · ') || null
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  options: DurationOptionPayload[]
}

export default function DurationCardsSelector({ options }: Props) {
  const { selectedPkg, setSelectedPkg } = useBookingState()

  // Derive selected index from shared context state
  const selectedIdx = useMemo(() => {
    const idx = options.findIndex(o => o.label === selectedPkg?.label)
    return idx >= 0 ? idx : 0
  }, [options, selectedPkg])

  function handleSelect(idx: number) {
    setSelectedPkg(options[idx])
  }

  if (options.length === 0) return null

  const gridClass =
    options.length === 1
      ? 'grid grid-cols-1'
      : options.length === 2
      ? 'grid grid-cols-1 sm:grid-cols-2'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <section className="mb-12">
      {/* Section header */}
      <div className="w-10 h-px mb-4" style={{ background: '#E67E50' }} />
      <p
        className="text-xs font-semibold uppercase tracking-[0.25em] mb-3 f-body"
        style={{ color: '#E67E50' }}
      >
        Trip options
      </p>
      <h2 className="text-[#0A2E4D] text-2xl font-bold mb-6 f-display">
        Choose your duration
      </h2>

      <div className={`${gridClass} gap-4`}>
        {options.map((opt, i) => {
          const { str: pStr, hint: pHint } = priceLabel(opt)
          const dur    = durationStr(opt)
          const isSel  = i === selectedIdx
          const isFirst = i === 0

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(i)}
              className="relative p-6 rounded-3xl flex flex-col gap-3 text-left transition-all group"
              style={
                isSel
                  ? {
                      background: 'rgba(10,46,77,0.06)',
                      border: '2px solid #0A2E4D',
                      boxShadow: '0 4px 20px rgba(10,46,77,0.12)',
                    }
                  : {
                      background: '#FDFAF7',
                      border: '1.5px solid rgba(10,46,77,0.09)',
                      boxShadow: '0 2px 12px rgba(10,46,77,0.04)',
                    }
              }
              aria-pressed={isSel}
            >
              {/* Most popular badge */}
              {isFirst && options.length > 1 && (
                <span
                  className="absolute -top-3 left-6 text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full f-body"
                  style={{ background: '#E67E50', color: 'white' }}
                >
                  Most popular
                </span>
              )}

              {/* Selected check mark */}
              {isSel && (
                <span
                  className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: '#0A2E4D' }}
                >
                  <Check size={10} strokeWidth={1.8} style={{ color: 'white' }} />
                </span>
              )}

              {/* Label + duration */}
              <div>
                <p
                  className="text-base font-bold f-display transition-colors"
                  style={{ color: '#0A2E4D' }}
                >
                  {opt.label || `Option ${i + 1}`}
                </p>
                {dur != null && (
                  <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    {dur}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="flex items-end gap-2 mt-1">
                <span
                  className="font-bold f-display transition-colors"
                  style={{ fontSize: '28px', color: isSel ? '#E67E50' : '#0A2E4D', lineHeight: 1 }}
                >
                  {pStr}
                </span>
                <span className="text-xs f-body pb-0.5" style={{ color: 'rgba(10,46,77,0.4)' }}>
                  {pHint}
                </span>
              </div>

              {/* Lodging badge */}
              {opt.includes_lodging && (
                <span
                  className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-full f-body"
                  style={{
                    background: isSel ? 'rgba(10,46,77,0.08)' : 'rgba(10,46,77,0.06)',
                    color: 'rgba(10,46,77,0.55)',
                  }}
                >
                  🏠 Lodging included
                </span>
              )}

              {/* Hover/select hint */}
              <p
                className="text-[11px] f-body mt-auto transition-all"
                style={{
                  color: isSel ? '#E67E50' : 'rgba(10,46,77,0.28)',
                  fontWeight: isSel ? 600 : 400,
                }}
              >
                {isSel ? '✓ Selected in booking panel' : 'Click to select →'}
              </p>
            </button>
          )
        })}
      </div>

      <p
        className="text-xs f-body mt-4"
        style={{ color: 'rgba(10,46,77,0.35)' }}
      >
        Group size and dates are set in the booking panel on the right.
      </p>
    </section>
  )
}
