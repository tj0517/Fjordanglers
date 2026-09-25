'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

// ─── Types (mirrored from page.tsx — kept minimal to avoid circular imports) ──

type ThreadItem =
  | { kind: 'angler_inquiry'; body: string; sentAt: string }
  | { kind: 'offer_sent'; totalEur: number; depositEur: number; notes: string | null; sentAt: string }
  | { kind: 'message'; id: string; direction: 'inbound' | 'outbound'; channel: string; counterpart: string; subject: string | null; body: string; draftedBy: string | null; sentAt: string }
  | { kind: 'deposit_sent'; depositEur: number; sentAt: string }
  | { kind: 'deposit_paid'; depositEur: number; paidAt: string }

interface Props {
  thread:     ThreadItem[]
  anglerName: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const COLLAPSE_THRESHOLD = 400

// Returns true when a message item should start collapsed
function shouldCollapse(item: ThreadItem, index: number, thread: ThreadItem[]): boolean {
  if (item.kind !== 'message' && item.kind !== 'angler_inquiry') return false
  const body = item.kind === 'message' ? item.body : item.body
  if (body.length <= COLLAPSE_THRESHOLD) return false

  // The last message in the thread is always shown in full
  if (index === thread.length - 1) return false

  // Inbound messages after the last outbound message are shown in full
  if (item.kind === 'message' && item.direction === 'inbound') {
    const lastOutboundIdx = [...thread].reduceRight((found, t, i) => {
      if (found !== -1) return found
      if (t.kind === 'message' && t.direction === 'outbound') return i
      return -1
    }, -1)
    if (lastOutboundIdx !== -1 && index > lastOutboundIdx) return false
  }

  return true
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThreadView({ thread, anglerName }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {thread.map((item, i) => {
        const itemId = item.kind === 'message' ? item.id : `${item.kind}-${i}`
        const collapsed = shouldCollapse(item, i, thread) && !expandedIds.has(itemId)

        if (item.kind === 'angler_inquiry') {
          const body = collapsed ? item.body.slice(0, COLLAPSE_THRESHOLD) + '…' : item.body
          return (
            <div key={itemId} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold f-body bg-primary/10 text-primary">
                {anglerName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-bold f-body text-foreground">{anglerName}</span>
                  <span className="text-[10px] f-body text-muted-foreground">{fmtDateTime(item.sentAt)}</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded f-body bg-muted text-muted-foreground">Inquiry</span>
                </div>
                <div className="px-3 py-2.5 rounded-xl text-sm f-body leading-relaxed italic bg-muted/40 border border-border/50 text-foreground/80 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  &ldquo;{body}&rdquo;
                </div>
                {shouldCollapse(item, i, thread) && (
                  <Button variant="ghost" size="xs" onClick={() => toggleExpand(itemId)} className="mt-1 text-muted-foreground">
                    {collapsed ? `Show full (${item.body.length} chars)` : 'Collapse'}
                  </Button>
                )}
              </div>
            </div>
          )
        }

        if (item.kind === 'offer_sent') return (
          <div key={itemId} className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] bg-accent text-white">FA</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-bold f-body text-foreground">FjordAnglers</span>
                <span className="text-[10px] f-body text-muted-foreground">{fmtDateTime(item.sentAt)}</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded f-body bg-accent/10 text-accent border border-accent/25">
                  Offer sent
                </span>
              </div>
              <div className="px-4 py-3 rounded-xl bg-accent/7 border border-accent/18">
                <div className="flex flex-wrap gap-x-6 gap-y-1 mb-1">
                  <span className="text-xs f-body text-foreground">Total: <strong>€{item.totalEur.toFixed(2)}</strong></span>
                  <span className="text-xs f-body text-foreground">Deposit: <strong>€{item.depositEur.toFixed(2)}</strong></span>
                  <span className="text-xs f-body text-foreground">Balance: <strong>€{(item.totalEur - item.depositEur).toFixed(2)}</strong></span>
                </div>
                {item.notes != null && item.notes.trim() !== '' && (
                  <p className="text-xs f-body italic mt-1.5 text-muted-foreground">&ldquo;{item.notes}&rdquo;</p>
                )}
              </div>
            </div>
          </div>
        )

        if (item.kind === 'message') {
          const isInbound   = item.direction === 'inbound'
          const channelLabel = item.channel.charAt(0).toUpperCase() + item.channel.slice(1)
          const senderLabel = isInbound
            ? (item.counterpart === 'guide' ? 'Guide' : anglerName)
            : (item.draftedBy === 'agent' ? 'AI Agent' : 'FjordAnglers')
          const avatarBg = isInbound
            ? 'bg-primary/10 text-primary'
            : item.draftedBy === 'agent'
              ? 'bg-[#6366F1] text-white'
              : 'bg-primary text-primary-foreground'

          const body = collapsed ? item.body.slice(0, COLLAPSE_THRESHOLD) + '…' : item.body

          return (
            <div key={item.id} className="flex gap-3">
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold f-body ${avatarBg}`}>
                {isInbound ? senderLabel.charAt(0).toUpperCase() : 'FA'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-bold f-body text-foreground">{senderLabel}</span>
                  <span className="text-[10px] f-body text-muted-foreground">{fmtDateTime(item.sentAt)}</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded f-body bg-muted text-muted-foreground">
                    {channelLabel} · {item.direction}
                  </span>
                </div>
                <div className={`px-3 py-2.5 rounded-xl border border-border/50 ${isInbound ? 'bg-muted/30' : 'bg-muted/50'}`}>
                  {item.subject != null && item.subject.trim() !== '' && (
                    <p className="text-xs font-bold f-body mb-1 text-foreground">{item.subject}</p>
                  )}
                  <p className="text-sm f-body leading-relaxed text-foreground/85 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{body}</p>
                </div>
                {shouldCollapse(item, i, thread) && (
                  <Button variant="ghost" size="xs" onClick={() => toggleExpand(item.id)} className="mt-1 text-muted-foreground">
                    {collapsed ? `Show full (${item.body.length} chars)` : 'Collapse'}
                  </Button>
                )}
              </div>
            </div>
          )
        }

        if (item.kind === 'deposit_sent') return (
          <div key={itemId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
            <span className="text-[11px] f-body text-blue-700">
              Deposit link sent — €{item.depositEur.toFixed(2)} — awaiting payment
            </span>
          </div>
        )

        if (item.kind === 'deposit_paid') return (
          <div key={itemId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200">
            <span className="text-[11px] f-body font-semibold text-green-800">
              Deposit paid — €{item.depositEur.toFixed(2)} — {fmtDateTime(item.paidAt)}
            </span>
          </div>
        )

        return null
      })}
    </div>
  )
}
