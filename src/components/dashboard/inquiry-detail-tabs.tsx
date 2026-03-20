'use client'

/**
 * InquiryDetailTabs — tabbed display of an angler's inquiry data.
 *
 * Tabs:
 *   - Request  — angler info + trip details (always shown)
 *   - Logistics — gear, accommodation, transport, budget (hidden when empty)
 *   - Context  — photography, notes, region (hidden when empty)
 *
 * All values are pre-computed strings passed from the Server Component —
 * this component is purely presentational and has no data-fetching logic.
 */

import { useState } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'request' | 'logistics' | 'context'

export type InquiryDetailTabsProps = {
  // ── Angler ────────────────────────────────────────────────────────────────
  anglerName:  string
  anglerEmail: string

  // ── Request tab ────────────────────────────────────────────────────────────
  tripTypeLabel?:   string     // e.g. "Full day (~8 hrs)"
  tripDays:         string     // e.g. "3 days"
  datesLabel:       string     // "Preferred window" | "Dates"
  datesValue:       string     // "2026-07-01 → 2026-07-31"
  preferredMonths?: string     // "Jul 2026, Aug 2026"
  groupValue:       string     // "3 anglers · incl. beginners"
  experienceLabel?: string     // "Intermediate"
  speciesValue:     string     // "Salmon, Brown Trout"

  // ── Logistics tab ──────────────────────────────────────────────────────────
  gearValue?:          string
  accommodationValue?: string
  transportValue?:     string
  boatPreference?:     string
  dietaryValue?:       string
  budgetValue?:        string
  riverType?:          string

  // ── Context tab ────────────────────────────────────────────────────────────
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

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'request',   label: 'Request'   },
    ...(hasLogistics ? [{ key: 'logistics' as const, label: 'Logistics' }] : []),
    ...(hasContext   ? [{ key: 'context'   as const, label: 'Context'   }] : []),
  ]

  const [active, setActive] = useState<TabKey>('request')

  // If only one tab, render without the tab bar
  const showTabBar = tabs.length > 1

  return (
    <div className="flex flex-col gap-4">

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      {showTabBar && (
        <div
          className="flex gap-1 p-1"
          style={{
            background:   'rgba(10,46,77,0.05)',
            borderRadius: '14px',
            width:        'fit-content',
          }}
        >
          {tabs.map(tab => {
            const isActive = active === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className="px-4 py-2 rounded-[10px] text-sm f-body transition-all"
                style={{
                  background: isActive ? 'white' : 'transparent',
                  color:      isActive ? '#0A2E4D' : 'rgba(10,46,77,0.5)',
                  fontWeight: isActive ? 600 : 400,
                  boxShadow:  isActive ? '0 1px 4px rgba(10,46,77,0.1)' : 'none',
                  border:     'none',
                  cursor:     'pointer',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Request ──────────────────────────────────────────────────────── */}
      {active === 'request' && (
        <div className="flex flex-col gap-5">

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

          <TabCard title="Trip Details">
            {props.tripTypeLabel != null && (
              <InfoRow label="Trip type"  value={props.tripTypeLabel} />
            )}
            <InfoRow label="Duration"    value={props.tripDays} />
            <InfoRow label={props.datesLabel} value={props.datesValue} />
            {props.preferredMonths != null && (
              <InfoRow label="Preferred months" value={props.preferredMonths} />
            )}
            <InfoRow label="Group"       value={props.groupValue} />
            {props.experienceLabel != null && (
              <InfoRow label="Experience" value={props.experienceLabel} />
            )}
            <InfoRow label="Target species" value={props.speciesValue} />
          </TabCard>

        </div>
      )}

      {/* ── Logistics ────────────────────────────────────────────────────── */}
      {active === 'logistics' && hasLogistics && (
        <TabCard title="Logistics & Pricing Info">
          {props.gearValue != null && (
            <InfoRow label="Gear" value={props.gearValue} />
          )}
          {props.accommodationValue != null && (
            <InfoRow label="Accommodation" value={props.accommodationValue} />
          )}
          {props.transportValue != null && (
            <InfoRow label="Transport" value={props.transportValue} />
          )}
          {props.boatPreference != null && props.boatPreference.length > 0 && (
            <InfoRow label="Boat preference" value={props.boatPreference} />
          )}
          {props.dietaryValue != null && props.dietaryValue.length > 0 && (
            <InfoRow label="Dietary / lunch" value={props.dietaryValue} />
          )}
          {props.budgetValue != null && (
            <InfoRow label="Budget" value={props.budgetValue} />
          )}
          {props.riverType != null && props.riverType.length > 0 && (
            <InfoRow label="Water type" value={props.riverType} />
          )}
        </TabCard>
      )}

      {/* ── Context ──────────────────────────────────────────────────────── */}
      {active === 'context' && hasContext && (
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
