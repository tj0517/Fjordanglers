/**
 * InquiryDetailTabs — flat display of all angler inquiry data (no tabs).
 * All sections are always visible: Angler, Trip Details, Logistics, Context.
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
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function InquiryDetailTabs(props: InquiryDetailTabsProps) {

  const hasLogistics = Boolean(
    props.gearValue || props.accommodationValue || props.transportValue ||
    props.boatPreference || props.dietaryValue || props.budgetValue || props.riverType
  )
  const hasContext = Boolean(
    props.stayingAt || props.photographyValue ||
    props.regionExperience || props.notes
  )

  return (
    <div className="flex flex-col gap-4">

      {/* ── Angler ───────────────────────────────────────────────────────── */}
      <TabCard title="Angler">
        <InfoRow label="Name" value={props.anglerName} />
        <InfoRow label="Email">
          <a
            href={`mailto:${props.anglerEmail}`}
            className="text-sm f-body font-medium hover:underline"
            style={{ color: '#E67E50' }}
          >
            {props.anglerEmail}
          </a>
        </InfoRow>
      </TabCard>

      {/* ── Trip Details ─────────────────────────────────────────────────── */}
      <TabCard title="Trip Details">
        {props.tripTypeLabel != null && (
          <InfoRow label="Trip type"      value={props.tripTypeLabel} />
        )}
        <InfoRow label="Duration"         value={props.tripDays} />
        <InfoRow label={props.datesLabel} value={props.datesValue} />
        {props.preferredMonths != null && (
          <InfoRow label="Preferred months" value={props.preferredMonths} />
        )}
        <InfoRow label="Group"            value={props.groupValue} />
        {props.experienceLabel != null && (
          <InfoRow label="Experience"     value={props.experienceLabel} />
        )}
        <InfoRow label="Target species"   value={props.speciesValue} />
      </TabCard>

      {/* ── Logistics ────────────────────────────────────────────────────── */}
      {hasLogistics && (
        <TabCard title="Logistics & Pricing Info">
          {props.gearValue != null && (
            <InfoRow label="Gear"            value={props.gearValue} />
          )}
          {props.accommodationValue != null && (
            <InfoRow label="Accommodation"   value={props.accommodationValue} />
          )}
          {props.transportValue != null && (
            <InfoRow label="Transport"       value={props.transportValue} />
          )}
          {props.boatPreference != null && props.boatPreference.length > 0 && (
            <InfoRow label="Boat preference" value={props.boatPreference} />
          )}
          {props.dietaryValue != null && props.dietaryValue.length > 0 && (
            <InfoRow label="Dietary / lunch" value={props.dietaryValue} />
          )}
          {props.budgetValue != null && (
            <InfoRow label="Budget"          value={props.budgetValue} />
          )}
          {props.riverType != null && props.riverType.length > 0 && (
            <InfoRow label="Water type"      value={props.riverType} />
          )}
        </TabCard>
      )}

      {/* ── Context ──────────────────────────────────────────────────────── */}
      {hasContext && (
        <TabCard title="Context">
          {props.stayingAt != null && props.stayingAt.length > 0 && (
            <InfoRow label="Staying at" value={props.stayingAt} />
          )}
          {props.photographyValue != null && (
            <InfoRow label="Photography" value={props.photographyValue} />
          )}
          {props.regionExperience != null && props.regionExperience.length > 0 && (
            <InfoRow label="Region experience" value={props.regionExperience} />
          )}
          {props.notes != null && props.notes.length > 0 && (
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body"
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                Angler notes
              </p>
              <p
                className="text-sm f-body whitespace-pre-wrap leading-relaxed"
                style={{ color: 'rgba(10,46,77,0.72)' }}
              >
                {props.notes}
              </p>
            </div>
          )}
        </TabCard>
      )}

    </div>
  )
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function TabCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-6"
      style={{
        background:   '#FDFAF7',
        borderRadius: '20px',
        border:       '1px solid rgba(10,46,77,0.08)',
      }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 f-body"
        style={{ color: 'rgba(10,46,77,0.38)' }}
      >
        {title}
      </p>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  highlight = false,
  children,
}: {
  label:      string
  value?:     string
  highlight?: boolean
  children?:  React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt
        className="text-xs f-body flex-shrink-0"
        style={{ color: 'rgba(10,46,77,0.45)', width: 130 }}
      >
        {label}
      </dt>
      <dd
        className="text-sm f-body text-right"
        style={{ color: highlight ? '#E67E50' : '#0A2E4D', fontWeight: highlight ? 700 : 500 }}
      >
        {children ?? value}
      </dd>
    </div>
  )
}
