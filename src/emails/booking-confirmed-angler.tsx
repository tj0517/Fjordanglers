import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface BookingConfirmedAnglerEmailProps {
  anglerName: string
  guideName: string
  experienceTitle: string
  bookingId: string
  bookingDate: string        // YYYY-MM-DD
  dateTo: string | null      // YYYY-MM-DD or null
  requestedDates: string[]   // all selected dates
  guests: number
  packageLabel: string | null
  totalEur: number
  guideMessage: string | null
  meetingLocation: string | null
  /** Link to the booking detail page on the angler's account */
  bookingUrl: string
}

export function BookingConfirmedAnglerEmail({
  anglerName,
  guideName,
  experienceTitle,
  bookingDate,
  dateTo,
  requestedDates,
  guests,
  packageLabel,
  totalEur,
  guideMessage,
  meetingLocation,
  bookingUrl,
}: BookingConfirmedAnglerEmailProps) {
  const dateLabel = formatDateRange(bookingDate, dateTo, requestedDates)
  const totalFormatted = `€${totalEur.toFixed(2)}`

  return (
    <Html>
      <Head />
      <Preview>Booking confirmed — {experienceTitle} with {guideName}</Preview>
      <Body style={body}>

        {/* ── Header ── */}
        <Section style={header}>
          <Img
            src="https://fjordanglers.com/brand/white-logo.png"
            width={160}
            alt="FjordAnglers"
            style={{ display: 'block', margin: '0 auto', width: '160px', height: 'auto' }}
          />
        </Section>

        {/* ── Content ── */}
        <Container style={container}>
          <Heading style={h1}>Your trip is confirmed!</Heading>

          <Text style={text}>
            Hi {anglerName}, great news — <strong>{guideName}</strong> has confirmed your
            booking for <strong>{experienceTitle}</strong>.
          </Text>

          {/* ── Status badge ── */}
          <Section style={confirmedBadge}>
            <Text style={confirmedText}>Confirmed</Text>
          </Section>

          {/* ── Guide message ── */}
          {guideMessage != null && guideMessage.trim() !== '' && (
            <Section style={messageBox}>
              <Text style={messageLabel}>Message from {guideName}</Text>
              <Text style={messageText}>&ldquo;{guideMessage}&rdquo;</Text>
            </Section>
          )}

          {/* ── Meeting location ── */}
          {meetingLocation != null && meetingLocation.trim() !== '' && (
            <Section style={locationBox}>
              <Text style={locationLabel}>Meeting location</Text>
              <Text style={locationText}>{meetingLocation}</Text>
            </Section>
          )}

          {/* ── Booking summary box ── */}
          <Section style={summaryBox}>
            <Text style={summaryHeading}>Trip summary</Text>
            <Hr style={summaryHr} />
            <Text style={summaryRow}>
              <span style={summaryLabel}>Experience</span>
              <span style={summaryValue}>{experienceTitle}</span>
            </Text>
            <Hr style={summaryHr} />
            <Text style={summaryRow}>
              <span style={summaryLabel}>Guide</span>
              <span style={summaryValue}>{guideName}</span>
            </Text>
            <Hr style={summaryHr} />
            <Text style={summaryRow}>
              <span style={summaryLabel}>Dates</span>
              <span style={summaryValue}>{dateLabel}</span>
            </Text>
            <Hr style={summaryHr} />
            <Text style={summaryRow}>
              <span style={summaryLabel}>Guests</span>
              <span style={summaryValue}>{guests} {guests === 1 ? 'angler' : 'anglers'}</span>
            </Text>
            {packageLabel != null && (
              <>
                <Hr style={summaryHr} />
                <Text style={summaryRow}>
                  <span style={summaryLabel}>Package</span>
                  <span style={summaryValue}>{packageLabel}</span>
                </Text>
              </>
            )}
            <Hr style={summaryHr} />
            <Text style={summaryRow}>
              <span style={summaryLabel}>Total</span>
              <span style={{ ...summaryValue, fontWeight: '700', color: '#0A2E4D' }}>{totalFormatted}</span>
            </Text>
          </Section>

          {/* ── CTA ── */}
          <Section style={ctaSection}>
            <Button style={button} href={bookingUrl}>
              View Booking Details →
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footerText}>
            Questions? Reply to this email and we&apos;ll get back to you.
          </Text>
          <Text style={footerSmall}>
            FjordAnglers · Connecting guides &amp; anglers across Scandinavia
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function formatDateRange(
  bookingDate: string,
  dateTo: string | null,
  requestedDates: string[],
): string {
  if (dateTo != null && dateTo !== bookingDate) {
    return `${fmtDate(bookingDate)} – ${fmtDate(dateTo)} (${requestedDates.length} days)`
  }
  return fmtDate(bookingDate)
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Styles ────────────────────────────────────────────────────────────────────

const body = {
  backgroundColor: '#F8FAFB',
  margin: 0,
  padding: 0,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif',
}

const header = {
  backgroundColor: '#0A2E4D',
  padding: '28px 40px',
}

const container = {
  backgroundColor: '#FFFFFF',
  margin: '0 auto',
  maxWidth: '600px',
  padding: '40px 48px 32px',
}

const h1 = {
  color: '#0A2E4D',
  fontSize: '26px',
  fontWeight: '700',
  lineHeight: '1.2',
  margin: '0 0 20px',
}

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
}

const confirmedBadge = {
  backgroundColor: '#F0FDF4',
  border: '1px solid rgba(34,197,94,0.3)',
  borderRadius: '8px',
  padding: '12px 20px',
  margin: '16px 0 20px',
  textAlign: 'center' as const,
}

const confirmedText = {
  color: '#15803D',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0',
}

const messageBox = {
  backgroundColor: '#F0FDF4',
  border: '1px solid rgba(34,197,94,0.2)',
  borderLeft: '3px solid #22C55E',
  borderRadius: '4px',
  padding: '16px 20px',
  margin: '0 0 20px',
}

const messageLabel = {
  color: '#15803D',
  fontSize: '11px',
  fontWeight: '700' as const,
  letterSpacing: '0.08em',
  margin: '0 0 6px',
  textTransform: 'uppercase' as const,
}

const messageText = {
  color: '#374151',
  fontSize: '15px',
  fontStyle: 'italic' as const,
  lineHeight: '24px',
  margin: '0',
}

const locationBox = {
  backgroundColor: '#EFF6FF',
  border: '1px solid rgba(59,130,246,0.2)',
  borderLeft: '3px solid #3B82F6',
  borderRadius: '4px',
  padding: '16px 20px',
  margin: '0 0 24px',
}

const locationLabel = {
  color: '#1D4ED8',
  fontSize: '11px',
  fontWeight: '700' as const,
  letterSpacing: '0.08em',
  margin: '0 0 6px',
  textTransform: 'uppercase' as const,
}

const locationText = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0',
}

const summaryBox = {
  backgroundColor: '#F8FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  padding: '20px 24px',
  margin: '24px 0',
}

const summaryHeading = {
  color: '#0A2E4D',
  fontSize: '13px',
  fontWeight: '700' as const,
  letterSpacing: '0.06em',
  margin: '0 0 12px',
  textTransform: 'uppercase' as const,
}

const summaryRow = {
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  margin: '0',
  fontSize: '15px',
  lineHeight: '24px',
  color: '#374151',
}

const summaryLabel = {
  color: '#6B7280',
  fontWeight: '400' as const,
}

const summaryValue = {
  color: '#111827',
  fontWeight: '500' as const,
  textAlign: 'right' as const,
}

const summaryHr = {
  border: 'none',
  borderTop: '1px solid #E5E7EB',
  margin: '10px 0',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#E67E50',
  borderRadius: '8px',
  color: '#FFFFFF',
  display: 'inline-block' as const,
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
}

const hr = {
  border: 'none',
  borderTop: '1px solid #E5E7EB',
  margin: '32px 0 24px',
}

const footerText = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 8px',
  textAlign: 'center' as const,
}

const footerSmall = {
  color: '#9CA3AF',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0',
}
