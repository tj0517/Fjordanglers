'use client'
import { STATUSES, STATUS_LABELS, STATUS_MEANINGS, type InquiryStatus } from '@/lib/inquiries/state'

// Steps are all non-terminal statuses in order — derived from STATUSES, never hardcoded
const STEP_STATUSES = STATUSES.filter(
  (s): s is Exclude<InquiryStatus, 'lost' | 'cancelled'> =>
    s !== 'lost' && s !== 'cancelled',
)

export function StatusStepper({ current }: { current: InquiryStatus }) {
  const isTerminal = current === 'lost' || current === 'cancelled'
  const currentIndex = STEP_STATUSES.indexOf(current as Exclude<InquiryStatus, 'lost' | 'cancelled'>)

  if (isTerminal) {
    return (
      <div className="mb-6">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#991B1B',
          }}
          data-status={current}
          aria-label={STATUS_LABELS[current]}
        >
          <span style={{ fontSize: 8 }}>●</span>
          {STATUS_LABELS[current]}
          <span className="text-xs font-normal opacity-70">— {STATUS_MEANINGS[current]}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 overflow-x-auto">
      <div className="flex items-start gap-0 min-w-max">
        {STEP_STATUSES.map((s, i) => {
          const isCurrent  = s === current
          const isComplete = i < currentIndex

          return (
            <div key={s} className="flex items-start">
              {/* Step */}
              <div
                className="flex flex-col items-center gap-1.5"
                style={{ minWidth: 80, maxWidth: 100 }}
                data-status={s}
              >
                {/* Dot */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: isCurrent
                      ? '#E67E50'
                      : isComplete
                        ? '#0A2E4D'
                        : 'rgba(10,46,77,0.15)',
                    outline: isCurrent ? '3px solid rgba(230,126,80,0.25)' : undefined,
                    outlineOffset: isCurrent ? '2px' : undefined,
                  }}
                  aria-label={`${isCurrent ? 'Current: ' : isComplete ? 'Done: ' : ''}${STATUS_LABELS[s]}`}
                />
                {/* Label */}
                <span
                  className="text-[10px] text-center leading-tight px-1"
                  style={{
                    color: isCurrent ? '#E67E50' : isComplete ? '#0A2E4D' : 'rgba(10,46,77,0.35)',
                    fontWeight: isCurrent ? 700 : isComplete ? 500 : 400,
                  }}
                >
                  {STATUS_LABELS[s]}
                </span>
                {/* Meaning (current only) */}
                {isCurrent && (
                  <span
                    className="text-[9px] text-center leading-tight px-1"
                    style={{ color: 'rgba(230,126,80,0.7)' }}
                  >
                    {STATUS_MEANINGS[s]}
                  </span>
                )}
              </div>

              {/* Connector line (not after last item) */}
              {i < STEP_STATUSES.length - 1 && (
                <div
                  className="h-px mt-2 flex-shrink-0"
                  style={{
                    width: 24,
                    background: i < currentIndex
                      ? '#0A2E4D'
                      : 'rgba(10,46,77,0.15)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
