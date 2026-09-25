interface TimelineEvent {
  id:          string
  type:        string
  actor_kind:  string
  actor_id:    string | null
  occurred_at: string
  payload:     Record<string, unknown>
}

interface Props {
  events: TimelineEvent[]
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function EventTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        No events recorded yet.
      </p>
    )
  }

  return (
    <ol className="space-y-2">
      {events.map(evt => (
        <li key={evt.id} className="flex gap-3 items-start text-xs">
          <div
            className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: 'rgba(10,46,77,0.25)' }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{evt.type}</span>
              <span className="text-muted-foreground">
                {evt.actor_kind}
                {evt.actor_id != null ? ` (${evt.actor_id.slice(0, 8)})` : ''}
              </span>
              <span className="text-muted-foreground ml-auto">{fmtDateTime(evt.occurred_at)}</span>
            </div>
            {Object.keys(evt.payload).length > 0 && (
              <p className="text-muted-foreground mt-0.5 truncate">
                {Object.entries(evt.payload)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(' · ')}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
