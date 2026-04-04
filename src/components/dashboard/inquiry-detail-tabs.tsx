/**
 * InquiryDetailTabs — Q&A brief for guide review.
 *
 * Redesigned from a tile grid to a Q&A format:
 * each data point is shown under the question it answers,
 * so the guide immediately understands what the angler is asking.
 *
 * "Wants X days" — when the angler explicitly selected a trip length
 * from within their availability window — is rendered as a large
 * salmon-coloured callout, impossible to miss.
 *
 * Layout (vertical, single column):
 *   ┌─────────────────────────────────────────┐
 *   │ When are you available?                 │
 *   │   14 Jun – 22 Jun  [Flexible]           │
 *   ├────────────── salmon callout ───────────┤
 *   │ 🎣  WANTS 3 FISHING DAYS               │ ← only when numDays set
 *   ├─────────────────────────────────────────┤
 *   │ How large is your group?               │
 *   │   2 anglers · incl. beginners          │
 *   ├─────────────────────────────────────────┤
 *   │ What species are you targeting?        │
 *   │   [Atlantic Salmon] [Brown Trout]      │
 *   ├─────────────────────────────────────────┤
 *   │ What water type?   (only if specified)  │
 *   │   River                                │
 *   ├─────────────────────────────────────────┤
 *   │ What do you need?  (logistics)         │
 *   │   🎒 Own gear  🏠 Accommodation        │
 *   ├──────── green budget highlight ─────────┤
 *   │ 💰 Budget: €400 – €800                 │
 *   ├─────────────────────────────────────────┤
 *   │ Email: hello@angler.com                │
 *   └─────────────────────────────────────────┘
 *   ┌─────────────────────────────────────────┐
 *   │ Notes to guide  (blue, if any)         │
 *   └─────────────────────────────────────────┘
 *   ┌─────────────────────────────────────────┐
 *   │ Additional context  (if any)           │
 *   └─────────────────────────────────────────┘
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type InquiryDetailTabsProps = {
  // ── Angler ────────────────────────────────────────────────────────────────
  anglerName:  string
  anglerEmail: string

  // ── Request ────────────────────────────────────────────────────────────────
  tripTypeLabel?:   string
  tripDays:         string
  datesLabel:       string
  datesValue:       string
  preferredMonths?: string
  groupValue:       string
  experienceLabel?: string
  speciesValue:     string

  // ── Logistics ──────────────────────────────────────────────────────────────
  gearValue?:          string
  accommodationValue?: string
  transportValue?:     string
  boatPreference?:     string
  dietaryValue?:       string
  budgetValue?:        string
  riverType?:          string

  // ── Context ────────────────────────────────────────────────────────────────
  stayingAt?:         string
  photographyValue?:  string
  regionExperience?:  string
  notes?:             string

  // ── Multi-period dates ─────────────────────────────────────────────────────
  /** When angler selected multiple non-contiguous availability windows */
  allDatePeriods?:    { from: string; to: string }[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtIsoShort(iso: string): string {
  try {
    return new Date(iso.trim() + 'T12:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short',
    })
  } catch {
    return iso
  }
}

/** Converts "YYYY-MM-DD → YYYY-MM-DD" → "15 Jun – 20 Jun" */
function formatDatesDisplay(raw: string): string {
  if (!raw || raw === '—') return raw
  const parts = raw.split(' → ')
  if (parts.length === 2) {
    return `${fmtIsoShort(parts[0])} – ${fmtIsoShort(parts[1])}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return fmtIsoShort(raw)
  return raw
}

// ─── Divider ───────────────────────────────────────────────────────────────────

const divStyle: React.CSSProperties = { borderTop: '1px solid rgba(10,46,77,0.06)' }

// ─── QARow — question label + answer content ────────────────────────────────────

function QARow({
  question,
  children,
  noBorder = false,
}: {
  question:   string
  children:   React.ReactNode
  noBorder?:  boolean
}) {
  return (
    <div
      className="px-5 py-4 flex flex-col gap-1.5"
      style={noBorder ? {} : divStyle}
    >
      <p
        className="text-[9px] uppercase tracking-[0.24em] font-bold f-body"
        style={{ color: 'rgba(10,46,77,0.3)' }}
      >
        {question}
      </p>
      {children}
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function InquiryDetailTabs(props: InquiryDetailTabsProps) {
  const isFlexible   = props.datesLabel === 'Preferred window'
  const datesDisplay = formatDatesDisplay(props.datesValue)

  // Species as array
  const speciesList: string[] =
    props.speciesValue && props.speciesValue !== '—'
      ? props.speciesValue.split(',').map(s => s.trim()).filter(Boolean)
      : []

  // Group: split "2 anglers · incl. beginners" into primary + modifiers
  const groupParts   = props.groupValue.split(' · ')
  const groupPrimary = groupParts[0] ?? props.groupValue
  const groupMods    = groupParts.slice(1)

  // Logistics pills
  type Pill = { icon: string; value: string }
  const pills: Pill[] = []
  if (props.gearValue)          pills.push({ icon: '🎒', value: props.gearValue })
  if (props.accommodationValue) pills.push({ icon: '🏠', value: props.accommodationValue })
  if (props.transportValue)     pills.push({ icon: '🚗', value: props.transportValue })
  if (props.boatPreference)     pills.push({ icon: '⛵', value: props.boatPreference })
  if (props.dietaryValue)       pills.push({ icon: '🍽️', value: props.dietaryValue })

  // "Wants X days" — angler explicitly set a target trip length from within
  // their availability window (e.g. "I'm free 14–22 Jun, but want 3 fishing days").
  const hasNumDays   = props.tripDays.startsWith('wants ')
  const numDaysLabel = hasNumDays ? props.tripDays.replace('wants ', '') : null

  // Derive callout content for the always-visible orange duration panel.
  // Priority: explicit numDays > tripTypeLabel (half/full day) > tripDays (window length)
  const durationCallout: { question: string; main: string; sub: string | null } = (() => {
    if (hasNumDays && numDaysLabel) {
      return { question: 'How many fishing days?', main: numDaysLabel, sub: null }
    }
    if (props.tripTypeLabel) {
      // e.g. "Half day (~4 hrs)" → main="Half day", sub="~4 hrs"
      const match = props.tripTypeLabel.match(/^(.+?)\s*\((.+)\)\s*$/)
      return match
        ? { question: 'Trip duration', main: match[1].trim(), sub: match[2].trim() }
        : { question: 'Trip duration', main: props.tripTypeLabel, sub: null }
    }
    return { question: 'Trip duration', main: props.tripDays, sub: null }
  })()

  const hasLogistics = pills.length > 0
  const hasBudget    = Boolean(props.budgetValue)
  const hasWaterType = Boolean(props.riverType)
  const hasExtra     = Boolean(props.stayingAt || props.photographyValue || props.regionExperience)

  return (
    <div className="flex flex-col gap-3">

      {/* ══ Main Q&A card ═══════════════════════════════════════════════════════ */}
      <div
        style={{
          background:   '#FDFAF7',
          borderRadius: '20px',
          border:       '1px solid rgba(10,46,77,0.08)',
          overflow:     'hidden',
        }}
      >

        {/* Q1: When are you available? — always first, no top border */}
        <div className="px-5 py-4 flex flex-col gap-1.5">
          <p
            className="text-[9px] uppercase tracking-[0.24em] font-bold f-body"
            style={{ color: 'rgba(10,46,77,0.3)' }}
          >
            When are you available?
          </p>

          {props.allDatePeriods != null && props.allDatePeriods.length > 1 ? (
            <>
              <p
                className="text-[15px] font-bold f-display leading-tight"
                style={{ color: '#0A2E4D' }}
              >
                {props.allDatePeriods.length} availability windows
              </p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {props.allDatePeriods.map((p, i) => (
                  <span
                    key={i}
                    className="text-[10px] f-body font-semibold px-2 py-1 rounded-full"
                    style={{
                      background: 'rgba(10,46,77,0.06)',
                      color:      'rgba(10,46,77,0.58)',
                      border:     '1px solid rgba(10,46,77,0.09)',
                    }}
                  >
                    {fmtIsoShort(p.from)} – {fmtIsoShort(p.to)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p
              className="text-[16px] font-bold f-display leading-tight"
              style={{ color: '#0A2E4D' }}
            >
              {datesDisplay}
            </p>
          )}

          {/* Chips: flexible flag only — duration is in the orange callout below */}
          {isFlexible && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              <SmallChip color="blue">Flexible</SmallChip>
            </div>
          )}

          {props.preferredMonths && (
            <p
              className="text-[11px] f-body mt-0.5"
              style={{ color: 'rgba(10,46,77,0.4)' }}
            >
              Preferred: {props.preferredMonths}
            </p>
          )}
        </div>

        {/* ── Duration callout — always visible ───────────────────────────────── */}
        <div
          className="px-5 py-5 flex items-center justify-between gap-4"
          style={{
            background:   'rgba(230,126,80,0.07)',
            borderTop:    '1px solid rgba(230,126,80,0.15)',
            borderBottom: '1px solid rgba(230,126,80,0.15)',
          }}
        >
          <div>
            <p
              className="text-[9px] uppercase tracking-[0.24em] font-bold f-body mb-2"
              style={{ color: 'rgba(230,126,80,0.55)' }}
            >
              {durationCallout.question}
            </p>
            <p
              className="text-[34px] font-bold f-display leading-none"
              style={{ color: '#C4622A' }}
            >
              {durationCallout.main}
            </p>
            {durationCallout.sub != null && (
              <p
                className="text-[12px] f-body mt-1.5"
                style={{ color: 'rgba(196,98,42,0.6)' }}
              >
                {durationCallout.sub}
              </p>
            )}
          </div>
          <span style={{ fontSize: 34, lineHeight: 1, opacity: 0.65 }}>🎣</span>
        </div>

        {/* Q2: How large is your group? */}
        <QARow question="How large is your group?">
          <p
            className="text-[16px] font-bold f-display leading-tight"
            style={{ color: '#0A2E4D' }}
          >
            {groupPrimary}
          </p>
          {groupMods.length > 0 && (
            <p
              className="text-[12px] f-body"
              style={{ color: 'rgba(10,46,77,0.5)' }}
            >
              {groupMods.join(' · ')}
            </p>
          )}
          {props.experienceLabel && (
            <SmallChip color="neutral" className="mt-0.5">
              {props.experienceLabel}
            </SmallChip>
          )}
        </QARow>

        {/* Q3: What species are you targeting? */}
        <QARow question="What species are you targeting?">
          {speciesList.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {speciesList.map(sp => (
                <span
                  key={sp}
                  className="text-[11px] f-body font-medium px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(230,126,80,0.1)',
                    color:      '#C4622A',
                    border:     '1px solid rgba(230,126,80,0.16)',
                  }}
                >
                  {sp}
                </span>
              ))}
            </div>
          ) : (
            <p
              className="text-sm f-body"
              style={{ color: 'rgba(10,46,77,0.28)' }}
            >
              No preference
            </p>
          )}
        </QARow>

        {/* Q4: What water type? — only when specified */}
        {hasWaterType && (
          <QARow question="What water type?">
            <p
              className="text-sm font-semibold f-body"
              style={{ color: '#0A2E4D' }}
            >
              {props.riverType}
            </p>
          </QARow>
        )}

        {/* Q5: What do you need? — logistics pills */}
        {hasLogistics && (
          <div
            className="px-5 py-4"
            style={{
              ...divStyle,
              borderBottom: hasBudget ? '1px solid rgba(10,46,77,0.06)' : 'none',
            }}
          >
            <p
              className="text-[9px] uppercase tracking-[0.24em] font-bold f-body mb-2.5"
              style={{ color: 'rgba(10,46,77,0.3)' }}
            >
              What do you need?
            </p>
            <div className="flex flex-wrap gap-2">
              {pills.map(p => (
                <span
                  key={p.value}
                  className="inline-flex items-center gap-1.5 text-[11px] f-body px-2.5 py-1.5 rounded-full"
                  style={{
                    background: 'rgba(10,46,77,0.05)',
                    border:     '1px solid rgba(10,46,77,0.09)',
                    color:      'rgba(10,46,77,0.68)',
                  }}
                >
                  <span>{p.icon}</span>
                  {p.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Budget — green highlight */}
        {hasBudget && (
          <div
            className="px-5 py-3.5 flex items-center gap-3"
            style={{
              background:   'rgba(22,163,74,0.05)',
              borderBottom: '1px solid rgba(10,46,77,0.06)',
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(22,163,74,0.14)' }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>💰</span>
            </div>
            <div>
              <p
                className="text-[9px] uppercase tracking-[0.24em] font-bold f-body mb-0.5"
                style={{ color: 'rgba(22,163,74,0.6)' }}
              >
                What&apos;s your budget?
              </p>
              <p
                className="text-[15px] font-bold f-display"
                style={{ color: '#16A34A' }}
              >
                {props.budgetValue}
              </p>
            </div>
          </div>
        )}

        {/* Contact strip */}
        <div className="px-5 py-3 flex items-center gap-2.5">
          <p
            className="text-[9px] uppercase tracking-[0.24em] font-bold f-body flex-shrink-0"
            style={{ color: 'rgba(10,46,77,0.28)' }}
          >
            Email
          </p>
          <a
            href={`mailto:${props.anglerEmail}`}
            className="text-xs f-body font-medium hover:underline underline-offset-2 truncate"
            style={{ color: '#E67E50' }}
          >
            {props.anglerEmail}
          </a>
        </div>
      </div>

      {/* ══ Notes ════════════════════════════════════════════════════════════════ */}
      {props.notes && props.notes.length > 0 && (
        <div
          className="p-5 rounded-2xl"
          style={{
            background: 'rgba(59,130,246,0.04)',
            border:     '1.5px solid rgba(59,130,246,0.14)',
          }}
        >
          <p
            className="text-[9px] uppercase tracking-[0.24em] font-bold f-body mb-3"
            style={{ color: 'rgba(59,130,246,0.6)' }}
          >
            Notes to guide
          </p>
          <p
            className="text-sm f-body leading-relaxed whitespace-pre-wrap"
            style={{ color: '#0A2E4D' }}
          >
            {props.notes}
          </p>
        </div>
      )}

      {/* ══ Extra context ════════════════════════════════════════════════════════ */}
      {hasExtra && (
        <div
          className="px-5 py-4 rounded-2xl flex flex-col gap-2.5"
          style={{
            background: '#FDFAF7',
            border:     '1px solid rgba(10,46,77,0.06)',
          }}
        >
          <p
            className="text-[9px] uppercase tracking-[0.24em] font-bold f-body mb-0.5"
            style={{ color: 'rgba(10,46,77,0.28)' }}
          >
            Additional context
          </p>
          {props.stayingAt && (
            <ContextRow label="Staying at"  value={props.stayingAt}         />
          )}
          {props.photographyValue && (
            <ContextRow label="Photography" value={props.photographyValue}  />
          )}
          {props.regionExperience && (
            <ContextRow label="Region exp." value={props.regionExperience}  />
          )}
        </div>
      )}

    </div>
  )
}

// ─── Internal sub-components ───────────────────────────────────────────────────

function SmallChip({
  children,
  color,
  className,
}: {
  children:   React.ReactNode
  color:      'blue' | 'neutral'
  className?: string
}) {
  const isBlue = color === 'blue'
  return (
    <span
      className={`inline-block text-[10px] f-body font-semibold px-2 py-0.5 rounded-full${className ? ` ${className}` : ''}`}
      style={{
        background: isBlue ? 'rgba(59,130,246,0.1)'  : 'rgba(10,46,77,0.06)',
        color:      isBlue ? '#2563EB'                : 'rgba(10,46,77,0.55)',
      }}
    >
      {children}
    </span>
  )
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span
        className="text-xs f-body flex-shrink-0"
        style={{ color: 'rgba(10,46,77,0.4)', minWidth: 90 }}
      >
        {label}
      </span>
      <span
        className="text-sm f-body font-medium text-right"
        style={{ color: '#0A2E4D' }}
      >
        {value}
      </span>
    </div>
  )
}
