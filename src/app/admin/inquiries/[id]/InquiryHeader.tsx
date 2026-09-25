import { Badge } from '@/components/ui/badge'
import { StatusStepper } from '@/components/admin/inquiry/StatusStepper'
import { STATUS_LABELS, type InquiryStatus } from '@/lib/inquiries/state'

export interface HeaderFacts {
  trip:       string | null
  country:    string | null
  group:      string | null
  dates:      string | null
  guide:      string | null
  commission: string | null
}

interface Props {
  name:       string
  email:      string
  phone:      string | null
  status:     InquiryStatus
  /** e.g. { label: 'Received', at: '2026-09-25T16:32:00Z' } — shown left of the status pill */
  statusLine: { label: string; at: string } | null
  facts:      HeaderFacts
}

const FACT_LABELS: Array<{ key: keyof HeaderFacts; label: string }> = [
  { key: 'trip',       label: 'Trip' },
  { key: 'country',    label: 'Country' },
  { key: 'group',      label: 'Group' },
  { key: 'dates',      label: 'Dates' },
  { key: 'guide',      label: 'Guide' },
  { key: 'commission', label: 'Commission' },
]

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Inquiry card header — name + contact left, status right; labelled facts grid; stage bar (FA-1.32). */
export function InquiryHeader({ name, email, phone, status, statusLine, facts }: Props) {
  return (
    <section className="rounded-2xl border border-border bg-card px-7 py-6 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center f-display text-[22px] font-bold shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="f-display text-[28px] font-bold leading-[1.15] text-foreground truncate">{name}</h1>
            <p className="text-sm f-body text-muted-foreground truncate">
              {email}{phone != null && phone !== '' ? ` · ${phone}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {statusLine != null && (
            <span className="text-xs f-body text-muted-foreground">
              {statusLine.label} {formatStamp(statusLine.at)}
            </span>
          )}
          <Badge data-status={status} className="status-badge text-[13px] font-semibold px-3 py-1.5 h-auto" variant="outline">
            {STATUS_LABELS[status]}
          </Badge>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-border/60 m-0">
        {FACT_LABELS.map(({ key, label }) => {
          const value = facts[key]
          return (
            <div key={key} className="flex flex-col gap-1 min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">{label}</dt>
              <dd className={value != null ? 'm-0 text-sm font-semibold f-body text-foreground truncate' : 'm-0 text-sm font-semibold f-body text-muted-foreground'}>
                {value ?? '—'}
              </dd>
            </div>
          )
        })}
      </dl>

      <StatusStepper current={status} />
    </section>
  )
}
