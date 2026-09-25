'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  dealTrackerSummary: string
  dealTracker:        React.ReactNode
  externalOffer:      React.ReactNode
  reviewSummary:      string
  /** Review link is generated after the trip is paid; before that the row is inert. */
  reviewEnabled:      boolean
  reviewLink:         React.ReactNode
}

type RowId = 'deal' | 'review'

function RowButton({ label, summary, isOpen, disabled = false, onClick }: {
  label: string; summary: string; isOpen: boolean; disabled?: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={isOpen}
      className={cn(
        'flex items-center justify-between gap-3 min-h-11 px-6 text-sm f-body text-left w-full',
        disabled ? 'text-muted-foreground cursor-default' : 'text-foreground hover:bg-muted/40 cursor-pointer',
      )}
    >
      <span>{label}</span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {summary}
        {!disabled && (isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />)}
      </span>
    </button>
  )
}

/** "Internal" rows — each opens the EXISTING component inline (FA-1.32). */
export function InternalRows({ dealTrackerSummary, dealTracker, externalOffer, reviewSummary, reviewEnabled, reviewLink }: Props) {
  const [open, setOpen] = useState<RowId | null>(null)

  function toggle(id: RowId) {
    setOpen(prev => (prev === id ? null : id))
  }

  return (
    <section className="rounded-2xl border border-border bg-card py-2 flex flex-col">
      <p className="px-6 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">Internal</p>

      <RowButton label="Deal tracker" summary={dealTrackerSummary} isOpen={open === 'deal'} onClick={() => toggle('deal')} />
      {open === 'deal' && <div className="px-6 pb-4">{dealTracker}</div>}

      <div className="flex items-center justify-between gap-3 min-h-11 px-6 text-sm f-body text-foreground">
        <span>External offer sent</span>
        {externalOffer}
      </div>

      <RowButton label="Review link" summary={reviewSummary} isOpen={open === 'review'} disabled={!reviewEnabled} onClick={() => toggle('review')} />
      {open === 'review' && reviewEnabled && <div className="px-6 pb-4">{reviewLink}</div>}
    </section>
  )
}
