import type { TripDetails } from '@/actions/inquiries'

const DATE_FLEX_LABEL: Record<string, string> = {
  fixed:          'Fixed — not flexible',
  flexible_1_2:   'Slightly flexible (±1–2 days)',
  flexible_week:  'Flexible within the week',
  very_flexible:  'Very flexible (month only)',
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function BriefRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start justify-between gap-4 py-3"
      style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] f-body flex-shrink-0"
        style={{ color: 'rgba(10,46,77,0.38)', minWidth: '110px' }}>
        {label}
      </span>
      <span className="text-sm f-body text-right leading-relaxed" style={{ color: '#0A2E4D' }}>
        {value}
      </span>
    </div>
  )
}

interface Props {
  anglerName:      string
  requestedDates:  string[]
  partySize:       number
  experienceTitle: string | null
  details:         TripDetails | null
}

export function TripBriefCard({ anglerName, requestedDates, partySize, experienceTitle, details }: Props) {
  const hasManual = details != null && (
    details.price_range      != null ||
    details.date_flexibility != null ||
    details.target_species   != null ||
    details.accommodation    != null ||
    details.guide_notes      != null
  )

  const datesText = requestedDates.length > 0
    ? requestedDates.map(fmtDate).join(', ')
    : 'To be confirmed'

  const flexLabel = details?.date_flexibility
    ? DATE_FLEX_LABEL[details.date_flexibility] ?? null
    : null

  return (
    <div className="rounded-[22px] overflow-hidden mb-4"
      style={{ background: '#FDFAF7', border: '1px solid rgba(10,46,77,0.07)' }}>
      <div className="px-6 py-4"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.08)', background: 'rgba(230,126,80,0.03)' }}>
        <h2 className="text-sm font-bold f-display text-[#0A2E4D]">Trip Brief</h2>
      </div>
      <div className="px-6 pb-2">

        {/* Manual: price range first */}
        <BriefRow label="Price range"   value={details?.price_range ?? undefined} />

        {/* Dates with flexibility */}
        <div className="flex items-start justify-between gap-4 py-3"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] f-body flex-shrink-0"
            style={{ color: 'rgba(10,46,77,0.38)', minWidth: '110px' }}>Dates</span>
          <div className="text-right">
            <p className="text-sm f-body leading-relaxed" style={{ color: '#0A2E4D' }}>{datesText}</p>
            {flexLabel != null && (
              <p className="text-[11px] f-body mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                {flexLabel}
              </p>
            )}
          </div>
        </div>

        {/* Group size */}
        <BriefRow label="Group size"
          value={`${partySize} ${partySize === 1 ? 'person' : 'people'}`} />

        {/* Manual: species */}
        <BriefRow label="Target species" value={details?.target_species ?? undefined} />

        {/* Manual: accommodation */}
        <BriefRow label="Accommodation"  value={details?.accommodation  ?? undefined} />

        {/* Auto: experience */}
        <BriefRow label="Experience"     value={experienceTitle ?? undefined} />

        {/* Manual: note */}
        <BriefRow label="Note from FA"   value={details?.guide_notes    ?? undefined} />

        {!hasManual && (
          <p className="text-xs f-body italic py-4" style={{ color: 'rgba(10,46,77,0.38)' }}>
            Trip details will appear here once FjordAnglers adds them.
          </p>
        )}
      </div>
    </div>
  )
}
