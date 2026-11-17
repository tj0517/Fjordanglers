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
import { NAVY } from '@/components/site/ui'

/** One letter per month at 390 px, the three-letter name from `sm`; the full name for screen readers. */
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The 2026-11 mockup's bar colours: navy peak, river blue for open, sand for closed. */
const STATE_COLOUR = { peak: NAVY, open: '#8FB3CF', closed: '#DDD3C4' } as const
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
      <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.12em]" style={mutedStyle}>
        Season, month by month
      </p>
      <ol className="m-0 grid list-none grid-cols-12 gap-[5px] p-0 text-center text-[13px] sm:text-[13.5px]">
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

          const cellStyle = { color: state === 'closed' ? 'rgba(10,46,77,0.55)' : NAVY }

          // The month's name over its bar. The month on show gets a navy ring round the bar —
          // a box-shadow, so it takes no space and nothing in the row moves.
          const label = (
            <>
              <span aria-hidden className={isShown ? 'font-bold' : undefined}>
                <span className="sm:hidden">{initial}</span>
                <span className="hidden sm:inline">{MONTH_SHORT[index]}</span>
              </span>
              <span className="sr-only">{MONTH_NAMES[index]}</span>
              <span
                aria-hidden
                className="mt-2.5 block h-2.5 w-full rounded-[3px]"
                style={{ background: STATE_COLOUR[state], ...(isShown ? { boxShadow: `0 0 0 2px #FDFAF7, 0 0 0 4px ${NAVY}` } : {}) }}
              />
            </>
          )

          return (
            <li key={month} data-month={month} data-state={state} data-active={isShown || undefined} title={title}>
              {periodIndex == null ? (
                <div className="flex min-w-0 flex-col items-center py-1" style={cellStyle}>{label}</div>
              ) : (
                <button
                  type="button"
                  className="flex w-full min-w-0 cursor-pointer flex-col items-center rounded py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2E4D]"
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
                  style={{ background: inShown ? 'var(--fa-salmon)' : 'transparent' }}
                />
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-3.5 text-[13px]" style={mutedStyle}>
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

          <div id={panelId} data-testid="season-panel" className="mt-4 rounded-[12px] border px-4 py-3.5" style={{ borderColor: '#E3DBCE', background: '#FFFFFF' }}>
            {shownPeriod != null ? (
              <>
                <p className="text-[15.5px] font-bold">{shownPeriod.title}</p>
                <p className="mt-1 whitespace-pre-line text-[14.5px] leading-[1.55]" style={mutedStyle}>
                  {shownPeriod.text}
                </p>
              </>
            ) : (
              <p className="text-[13.5px]" style={mutedStyle}>Pick a month to see what that part of the season is like.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
