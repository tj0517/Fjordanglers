import { Heading, Section, Text, Hr, Button, Link } from '@react-email/components'
import {
  EmailLayout,
  h1,
  text,
  textSmall,
  summaryBox,
  DetailRows,
  hr,
  noteBox,
  ctaSection,
} from './_shared'

const DATE_FLEX_LABEL: Record<string, string> = {
  fixed:         'Fixed — not flexible',
  flexible_1_2:  'Slightly flexible (±1–2 days)',
  flexible_week: 'Flexible within the week',
  very_flexible: 'Very flexible (month only)',
}

export interface GuideAssignedEmailProps {
  guideName:       string
  anglerName:      string
  anglerCountry:   string | null
  // Dates: confirmed_date from trip brief if FA filled it, otherwise raw requested_dates
  confirmedDate:   string | null   // free-text date override from FA
  requestedDates:  string[]        // original dates (fallback)
  dateFlexibility: string | null   // from inquiry_trip_details
  partySize:       number          // confirmed_party_size or inquiry.party_size
  // Trip brief (may be null if FA hasn't filled the brief yet)
  targetSpecies:   string | null
  priceRange:      string | null
  accommodation:   string | null
  guideNotes:      string | null   // FA's personal note to this guide
  anglerMessage:   string | null   // angler's original enquiry message
  // Links
  acceptUrl:  string  // /dashboard/trips/[id]?action=accept — one-click accept
  tripsUrl:   string  // /dashboard/trips/[id] — full details
}

export function GuideAssignedEmail({
  guideName,
  anglerName,
  anglerCountry,
  confirmedDate,
  requestedDates,
  dateFlexibility,
  partySize,
  targetSpecies,
  priceRange,
  accommodation,
  guideNotes,
  anglerMessage,
  acceptUrl,
  tripsUrl,
}: GuideAssignedEmailProps) {
  const dateDisplay = confirmedDate ?? fmtDates(requestedDates)
  const flexLabel   = dateFlexibility ? (DATE_FLEX_LABEL[dateFlexibility] ?? null) : null
  const countryPart = anglerCountry ? ` (${anglerCountry})` : ''

  // Build detail rows — skip empty fields so the table stays clean
  const rows: { label: string; value: string; subValue?: string; last?: boolean }[] = []
  rows.push({ label: 'Angler', value: `${anglerName}${countryPart}` })
  rows.push({ label: 'Date(s)', value: dateDisplay, subValue: flexLabel ?? undefined })
  rows.push({ label: 'Party size', value: `${partySize} ${partySize === 1 ? 'person' : 'people'}` })
  if (targetSpecies) rows.push({ label: 'Target species', value: targetSpecies })
  if (priceRange)    rows.push({ label: 'Price range', value: priceRange })
  if (accommodation) rows.push({ label: 'Accommodation', value: accommodation })
  rows[rows.length - 1].last = true

  return (
    <EmailLayout preview={`New trip assigned: ${anglerName} — please confirm your availability`}>
      <Heading style={h1}>New trip assigned to you</Heading>

      <Text style={text}>
        Hi {guideName}, Tymon from FjordAnglers has assigned you a new enquiry.
        Here are the details for the trip you need to prepare an offer for.
      </Text>

      {/* Trip brief summary */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={summaryBox}>
        <tbody>
          <DetailRows rows={rows} />
        </tbody>
      </table>

      {/* FA's personal note to guide (highlighted) */}
      {guideNotes != null && guideNotes.trim() !== '' && (
        <div style={noteBox}>
          <Text style={{ ...textSmall, margin: 0, color: '#1E40AF', fontWeight: 600 }}>
            Note from Tymon
          </Text>
          <Text style={{ ...textSmall, margin: '6px 0 0', color: '#1E40AF', fontStyle: 'italic' }}>
            {guideNotes}
          </Text>
        </div>
      )}

      {/* Angler's original message */}
      {anglerMessage != null && anglerMessage.trim() !== '' && (
        <div style={{ margin: '0 0 24px', padding: '14px 18px', borderLeft: '3px solid #E5E7EB', background: '#FAFAFA' }}>
          <Text style={{ ...textSmall, margin: '0 0 4px', color: '#6B7280', fontWeight: 600 }}>
            Angler&apos;s message
          </Text>
          <Text style={{ ...textSmall, margin: 0, fontStyle: 'italic', color: '#374151' }}>
            &ldquo;{anglerMessage}&rdquo;
          </Text>
        </div>
      )}

      <Text style={text}>
        Please let us know as soon as possible if you can take this trip —
        click below to accept or view the full details in your dashboard.
      </Text>

      {/* Primary CTA: Accept */}
      <Section style={ctaSection}>
        <Button
          href={acceptUrl}
          style={{
            backgroundColor: '#E67E50',
            borderRadius: '8px',
            color: '#FFFFFF',
            display: 'inline-block',
            fontSize: '16px',
            fontWeight: '700',
            padding: '14px 36px',
            textDecoration: 'none',
          }}
        >
          ✓ Accept this trip
        </Button>
      </Section>

      {/* Secondary: view details + decline */}
      <Text style={{ ...textSmall, textAlign: 'center', margin: '0 0 8px' }}>
        <Link href={tripsUrl} style={{ color: '#0A2E4D', fontWeight: 600 }}>
          View full details in dashboard
        </Link>
      </Text>
      <Text style={{ ...textSmall, textAlign: 'center', color: '#9CA3AF', margin: 0 }}>
        Can&apos;t take this trip?{' '}
        <Link href={tripsUrl} style={{ color: '#9CA3AF' }}>
          Open dashboard to decline
        </Link>
      </Text>

      <Hr style={hr} />

      <Text style={textSmall}>
        Questions? Reply to this email or contact Tymon directly.
      </Text>
    </EmailLayout>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDates(dates: string[]): string {
  if (dates.length === 0) return 'To be confirmed'
  return dates.map(fmtDate).join(', ')
}
