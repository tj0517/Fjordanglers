'use client'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function SeasonCalendarGrid({
  seasonMonths,
  peakMonths,
  clickable = false,
}: {
  seasonMonths: number[]
  peakMonths:   number[]
  clickable?:   boolean
}) {
  function handleMonthClick(month: number) {
    window.dispatchEvent(new CustomEvent('open-inquiry-modal', { detail: { month } }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
        {MONTH_SHORT.map((label, i) => {
          const m      = i + 1
          const isPeak = peakMonths.includes(m)
          const isOpen = seasonMonths.includes(m)
          const active = isPeak || isOpen

          let bg: string, textColor: string, dotBg: string, statusText: string
          if (isPeak) {
            bg = '#E67E50'; textColor = '#fff'; dotBg = 'rgba(255,255,255,0.7)'; statusText = 'Peak'
          } else if (isOpen) {
            bg = 'rgba(230,126,80,0.08)'; textColor = 'rgba(10,46,77,0.65)'; dotBg = 'rgba(230,126,80,0.5)'; statusText = 'Open'
          } else {
            bg = 'rgba(10,46,77,0.035)'; textColor = 'rgba(10,46,77,0.2)'; dotBg = 'rgba(10,46,77,0.1)'; statusText = '—'
          }

          const content = (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-wide f-body" style={{ color: textColor }}>
                {label}
              </span>
              <span className="w-2 h-2 rounded-full" style={{ background: dotBg }} />
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] f-body text-center" style={{ color: textColor }}>
                {statusText}
              </span>
            </>
          )

          if (clickable && active) {
            return (
              <button
                key={label}
                type="button"
                onClick={() => handleMonthClick(m)}
                title={`Ask about ${MONTH_FULL[i]}`}
                aria-label={`Open inquiry for ${MONTH_FULL[i]}`}
                className="flex flex-col items-center justify-between rounded-2xl py-4 px-1 transition-all hover:brightness-110 hover:scale-[1.05]"
                style={{ background: bg, minHeight: '88px', cursor: 'pointer' }}
              >
                {content}
              </button>
            )
          }

          return (
            <div
              key={label}
              className="flex flex-col items-center justify-between rounded-2xl py-4 px-1"
              style={{ background: bg, minHeight: '88px' }}
            >
              {content}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 flex-wrap">
        {[
          { dot: '#E67E50',               label: 'Peak season' },
          { dot: 'rgba(230,126,80,0.5)',   label: 'Open season' },
          { dot: 'rgba(10,46,77,0.12)',    label: 'Off season'  },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.dot }} />
            <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
