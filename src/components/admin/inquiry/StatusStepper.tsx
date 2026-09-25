'use client'
import { STATUSES, STATUS_LABELS, STATUS_MEANINGS, type InquiryStatus } from '@/lib/inquiries/state'
import { cn } from '@/lib/utils'

// Steps are all non-terminal statuses in order — derived from STATUSES, never hardcoded
const STEP_STATUSES = STATUSES.filter(
  (s): s is Exclude<InquiryStatus, 'lost' | 'cancelled'> =>
    s !== 'lost' && s !== 'cancelled',
)

/** Segmented stage bar (FA-1.32 mockup): one segment per non-terminal status, filled up to the current one. */
export function StatusStepper({ current }: { current: InquiryStatus }) {
  const isTerminal = current === 'lost' || current === 'cancelled'
  const currentIndex = STEP_STATUSES.indexOf(current as Exclude<InquiryStatus, 'lost' | 'cancelled'>)

  if (isTerminal) {
    return (
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold f-body bg-destructive/10 border border-destructive/25 text-destructive self-start"
        data-status={current}
        aria-label={STATUS_LABELS[current]}
      >
        <span className="text-[8px]" aria-hidden="true">●</span>
        {STATUS_LABELS[current]}
        <span className="text-xs font-normal opacity-70">— {STATUS_MEANINGS[current]}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Stage">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${STEP_STATUSES.length}, minmax(0, 1fr))` }}>
        {STEP_STATUSES.map((s, i) => (
          <div
            key={s}
            role="listitem"
            data-status={s}
            aria-current={s === current ? 'step' : undefined}
            aria-label={`${s === current ? 'Current: ' : i < currentIndex ? 'Done: ' : ''}${STATUS_LABELS[s]}`}
            className={cn('h-1 rounded-sm', i <= currentIndex ? 'bg-primary' : 'bg-primary/15')}
          />
        ))}
      </div>
      <div className="grid gap-1 text-xs f-body" style={{ gridTemplateColumns: `repeat(${STEP_STATUSES.length}, minmax(0, 1fr))` }}>
        {STEP_STATUSES.map((s, i) => (
          <span key={s} className="flex flex-col gap-0.5 min-w-0">
            <span
              className={cn(
                'truncate',
                i < currentIndex && 'text-primary',
                i === currentIndex && 'text-primary font-bold',
                i > currentIndex && 'text-muted-foreground/80',
              )}
            >
              {STATUS_LABELS[s]}
            </span>
            {/* Current stage's one-line meaning — small muted text under the label (tj, review 2026-09-25) */}
            {i === currentIndex && (
              <span className="text-xs font-normal text-muted-foreground leading-snug">{STATUS_MEANINGS[s]}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
