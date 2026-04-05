// Server component — no 'use client'

const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

interface Props {
  from: string  // ISO "YYYY-MM-DD" — used when no `days` provided (range mode)
  to:   string  // ISO "YYYY-MM-DD" — used when no `days` provided (range mode)
  /**
   * Specific days to highlight — non-consecutive dates safe.
   * When provided, only these exact days are highlighted (no range stripe between them).
   * When omitted, falls back to highlighting the continuous from–to range.
   */
  days?: string[]
}

export function MicroCalendar({ from, to, days }: Props) {
  // ── Specific-days mode ──────────────────────────────────────────────────────
  if (days != null && days.length > 0) {
    const sorted = [...days].sort()

    // Collect unique months that contain at least one of the specified days
    const monthKeys = [...new Set(sorted.map(d => d.slice(0, 7)))]  // "YYYY-MM"

    // Guard: never render more than 3 months (edge case: long scattered trips)
    const visibleMonths = monthKeys.slice(0, 3)
    const hiddenCount   = monthKeys.length - visibleMonths.length

    const daySet = new Set(sorted)

    return (
      <div className="flex flex-wrap gap-5 justify-center">
        {visibleMonths.map(monthKey => {
          const [year, month] = monthKey.split('-').map(Number) as [number, number]
          return (
            <DaysMonthGrid
              key={monthKey}
              year={year}
              monthIdx={month - 1}
              highlightedDays={daySet}
            />
          )
        })}
        {hiddenCount > 0 && (
          <p
            className="self-end text-[10px] f-body pb-1"
            style={{ color: 'rgba(10,46,77,0.4)' }}
          >
            +{hiddenCount} more month{hiddenCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    )
  }

  // ── Range mode (original behaviour) ────────────────────────────────────────
  const startDate = new Date(from + 'T12:00:00')
  const endDate   = new Date(to   + 'T12:00:00')

  const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  const endMonth   = new Date(endDate.getFullYear(),   endDate.getMonth(),   1)
  const months     = startMonth.getTime() === endMonth.getTime()
    ? [startMonth]
    : [startMonth, endMonth]

  return (
    <div className="flex flex-wrap gap-5 justify-center">
      {months.map((month, idx) => (
        <RangeMonthGrid key={idx} month={month} from={startDate} to={endDate} />
      ))}
    </div>
  )
}

// ─── Specific-days month grid ─────────────────────────────────────────────────

function DaysMonthGrid({
  year,
  monthIdx,
  highlightedDays,
}: {
  year:            number
  monthIdx:        number      // 0-based
  highlightedDays: Set<string> // ISO strings "YYYY-MM-DD"
}) {
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const firstDay    = new Date(year, monthIdx, 1).getDay()
  const startOffset = (firstDay + 6) % 7  // Mon-first

  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthLabel = new Date(year, monthIdx, 1).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric',
  })

  return (
    <div>
      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body text-center"
        style={{ color: 'rgba(10,46,77,0.45)' }}
      >
        {monthLabel}
      </p>

      <div className="grid grid-cols-7">
        {DAY_HEADERS.map(d => (
          <div
            key={d}
            className="w-7 h-5 flex items-center justify-center text-[9px] font-bold f-body"
            style={{ color: 'rgba(10,46,77,0.3)' }}
          >
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day == null) return <div key={`e-${i}`} className="w-7 h-7" />

          const iso = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isHighlighted = highlightedDays.has(iso)

          return (
            <div key={day} className="relative w-7 h-7 flex items-center justify-center">
              {isHighlighted ? (
                <div
                  className="relative w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold f-display"
                  style={{ background: '#E67E50', color: '#fff' }}
                >
                  {day}
                </div>
              ) : (
                <span
                  className="relative text-[11px] f-body"
                  style={{ color: 'rgba(10,46,77,0.45)' }}
                >
                  {day}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Range month grid (original behaviour) ────────────────────────────────────

function RangeMonthGrid({ month, from, to }: { month: Date; from: Date; to: Date }) {
  const year        = month.getFullYear()
  const monthIdx    = month.getMonth()
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const firstDay    = new Date(year, monthIdx, 1).getDay()
  const startOffset = (firstDay + 6) % 7

  const fromNorm = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const toNorm   = new Date(to.getFullYear(),   to.getMonth(),   to.getDate())
  const isSingle = fromNorm.getTime() === toNorm.getTime()

  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div>
      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body text-center"
        style={{ color: 'rgba(10,46,77,0.45)' }}
      >
        {monthLabel}
      </p>

      <div className="grid grid-cols-7">
        {DAY_HEADERS.map(d => (
          <div
            key={d}
            className="w-7 h-5 flex items-center justify-center text-[9px] font-bold f-body"
            style={{ color: 'rgba(10,46,77,0.3)' }}
          >
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day == null) return <div key={`e-${i}`} className="w-7 h-7" />

          const thisDay       = new Date(year, monthIdx, day)
          const isStart       = thisDay.getTime() === fromNorm.getTime()
          const isEnd         = thisDay.getTime() === toNorm.getTime()
          const inRange       = thisDay >= fromNorm && thisDay <= toNorm
          const isHighlighted = isStart || isEnd || (isSingle && inRange)

          return (
            <div key={day} className="relative w-7 h-7 flex items-center justify-center">
              {inRange && !isSingle && (
                <div
                  className="absolute top-1 bottom-1"
                  style={{
                    left:       isStart ? '50%' : 0,
                    right:      isEnd   ? '50%' : 0,
                    background: 'rgba(230,126,80,0.18)',
                  }}
                />
              )}
              {isHighlighted ? (
                <div
                  className="relative w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold f-display"
                  style={{ background: '#E67E50', color: '#fff' }}
                >
                  {day}
                </div>
              ) : (
                <span
                  className="relative text-[11px] f-body"
                  style={{
                    color:      inRange ? '#0A2E4D' : 'rgba(10,46,77,0.45)',
                    fontWeight: inRange ? 600 : 400,
                  }}
                >
                  {day}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
