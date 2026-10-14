'use client'

/**
 * The twelve-month season bar of S11 (FA-1.55), and — since feedback round 1 — what each
 * part of the season is like (`season_periods`).
 *
 * The bar is drawn from `season_months` and `peak_months`, which the admin stores as month
 * numbers. `peak_months` entries outside `season_months` are shown as peak anyway — the data
 * says "best", and silently hiding a month the admin marked would be worse than an
 * inconsistent-looking bar that they can see and fix.
 *
 * A month whose period has text is a button. One panel under the bar shows that period's
 * title and text and swaps its content:
 *   • pointer devices — hovering a month previews its period;
 *   • click / tap — pins it (again on the same month unpins it, Esc too);
 *   • keyboard — focusing a month shows its period (`:focus-visible` only, so a mouse click
 *     does not leave a "focused" preview behind after the pointer leaves).
 * What the panel shows is, in that order: the hovered month, the keyboard-focused month, the
 * pinned month. The panel sits below the bar and the legend, so nothing in the bar moves.
 *
 * Months with no period, or with a period that has no text, are drawn exactly as before.
 */

import { useId, useState, type FocusEvent, type PointerEvent } from 'react'
import type { SeasonPeriod } from '@/lib/experience-v2-content'
import { mutedStyle } from './offer-box'

/** Wide enough to read at 390 px: one letter per month, with the full name in the title. */
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export type SeasonBarProps = {
  seasonMonths: number[]
  peakMonths:   number[]
  periods:      SeasonPeriod[]
}

const isMouse = (event: PointerEvent) => event.pointerType === 'mouse'

export default function SeasonBar({ seasonMonths, peakMonths, periods }: SeasonBarProps) {
  const [pinned,  setPinned]  = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const id = useId()

  const season = new Set(seasonMonths)
  const peak   = new Set(peakMonths)
  if (season.size === 0 && peak.size === 0) return null

  // month → index into `periods`, only for periods that have something to say.
  const periodOf = new Map<number, number>()
  periods.forEach((period, index) => {
    if (period.text != null) for (const month of period.months) periodOf.set(month, index)
  })
  const interactive = periodOf.size > 0

  const shownMonth  = hovered ?? focused ?? pinned
  const shownIndex  = shownMonth == null ? undefined : periodOf.get(shownMonth)
  const shownPeriod = shownIndex == null ? null : periods[shownIndex] ?? null

  const panelId       = `${id}-panel`
  const descriptionId = (index: number) => `${id}-period-${index}`

  return (
    <div data-testid="offer-season-bar">
      <p className="mb-1.5 text-[13px] uppercase tracking-wide" style={mutedStyle}>
        Season, month by month
      </p>
      <ol className="grid grid-cols-12 gap-[3px] text-center text-[11px]">
        {MONTH_INITIALS.map((initial, index) => {
          const month       = index + 1
          const isPeak      = peak.has(month)
          const isOpen      = season.has(month)
          const state       = isPeak ? 'peak' : isOpen ? 'open' : 'closed'
          const periodIndex = periodOf.get(month)
          const period      = periodIndex == null ? null : periods[periodIndex] ?? null
          const isShown     = shownMonth === month && period != null
          const inShown     = period != null && periodIndex === shownIndex
          const title       = `${MONTH_NAMES[index]} — ${isPeak ? 'best' : isOpen ? 'open' : 'closed'}${period != null ? ` · ${period.title}` : ''}`

          const cellStyle = {
            ...(isPeak
              ? { background: 'var(--fa-navy)', color: '#fff' }
              : isOpen
                ? { background: 'rgba(10,46,77,0.22)' }
                : { background: 'rgba(10,46,77,0.07)', color: 'rgba(10,46,77,0.45)' }),
            // An inset ring, not a border or outline: it takes no space and stays inside the cell,
            // so the active month never moves the bar or touches its neighbours. Navy edge + white
            // line reads on all three cell colours, the navy "best" month included.
            ...(isShown ? { boxShadow: 'inset 0 0 0 2px var(--fa-navy), inset 0 0 0 4px #fff' } : {}),
          }

          const label = (
            <>
              <span aria-hidden>{initial}</span>
              <span className="sr-only">{MONTH_NAMES[index]}</span>
            </>
          )

          return (
            <li key={month} data-month={month} data-state={state} data-active={isShown || undefined} title={title}>
              {periodIndex == null ? (
                <div className="rounded py-2" style={cellStyle}>{label}</div>
              ) : (
                <button
                  type="button"
                  className="block w-full cursor-pointer rounded py-2 focus-visible:outline-none"
                  style={cellStyle}
                  aria-pressed={pinned === month}
                  aria-controls={panelId}
                  aria-describedby={descriptionId(periodIndex)}
                  onClick={() => setPinned(current => (current === month ? null : month))}
                  onPointerEnter={event => { if (isMouse(event)) setHovered(month) }}
                  onPointerLeave={event => { if (isMouse(event)) setHovered(current => (current === month ? null : current)) }}
                  onFocus={(event: FocusEvent<HTMLButtonElement>) => {
                    if (event.currentTarget.matches(':focus-visible')) setFocused(month)
                  }}
                  onBlur={() => setFocused(current => (current === month ? null : current))}
                  onKeyDown={event => { if (event.key === 'Escape') setPinned(null) }}
                >
                  {label}
                </button>
              )}
              {/* Under every month, reserved whether drawn or not: which months share the period on show. */}
              {interactive && (
                <span
                  aria-hidden
                  className="mx-auto mt-1 block h-[3px] w-3/5 rounded-full"
                  style={{ background: inShown ? 'rgba(10,46,77,0.55)' : 'transparent' }}
                />
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-[12px]" style={mutedStyle}>
        dark = best months · mid = open · pale = closed
      </p>

      {interactive && (
        <>
          {/* What each month button is described by, for screen readers — always in the DOM. */}
          <div hidden>
            {periods.map((period, index) => period.text != null && (
              <span key={index} id={descriptionId(index)}>{period.title}. {period.text}</span>
            ))}
          </div>

          <div id={panelId} data-testid="season-panel" className="mt-3 rounded-xl px-3.5 py-3" style={{ background: 'rgba(10,46,77,0.05)' }}>
            {shownPeriod != null ? (
              <>
                <p className="text-[14px] font-semibold">{shownPeriod.title}</p>
                <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed" style={{ color: 'rgba(10,46,77,0.78)' }}>
                  {shownPeriod.text}
                </p>
              </>
            ) : (
              <p className="text-[13px]" style={mutedStyle}>Pick a month to see what that part of the season is like.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
