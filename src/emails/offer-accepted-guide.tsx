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

export interface OfferAcceptedGuideEmailProps {
  guideName: string
  anglerName: string
  experienceTitle: string
  bookingId: string
  confirmedDates: string[]   // ISO YYYY-MM-DD
  bookingUrl: string
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function OfferAcceptedGuideEmail({
  guideName,
  anglerName,
  experienceTitle,
  confirmedDates,
  bookingUrl,
}: OfferAcceptedGuideEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{anglerName} accepted your proposal — booking confirmed!</Preview>
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
          <Heading style={h1}>Booking confirmed!</Heading>

          <Text style={text}>
            Hi {guideName}, great news — <strong>{anglerName}</strong> has accepted
            your proposed dates for <strong>{experienceTitle}</strong>.
            The booking is now confirmed.
          </Text>

          {/* ── Confirmed badge ── */}
          <Section style={confirmedBadge}>
            <Text style={confirmedText}>✓ Confirmed</Text>
          </Section>

          {/* ── Confirmed dates ── */}
          <Section style={datesBox}>
            <Text style={datesLabel}>Confirmed dates</Text>
            <Text style={datesText}>
              {confirmedDates.map(fmtDate).join(' · ')}
            </Text>
          </Section>

          <Text style={text}>
            Check your dashboard for full booking details including the angler&apos;s
            contact information and any special requests.
          </Text>

          {/* ── CTA ── */}
          <Section style={ctaSection}>
            <Button style={button} href={bookingUrl}>
              View Booking →
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
  fontSize: '15px',
  fontWeight: '600' as const,
  margin: '0',
}

const datesBox = {
  backgroundColor: '#F0FDF4',
  border: '1px solid rgba(34,197,94,0.2)',
  borderLeft: '3px solid #22C55E',
  borderRadius: '4px',
  padding: '16px 20px',
  margin: '0 0 20px',
}

const datesLabel = {
  color: '#15803D',
  fontSize: '11px',
  fontWeight: '700' as const,
  letterSpacing: '0.08em',
  margin: '0 0 6px',
  textTransform: 'uppercase' as const,
}

const datesText = {
  color: '#0A2E4D',
  fontSize: '15px',
  fontWeight: '600' as const,
  lineHeight: '24px',
  margin: '0',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0 24px',
}

const button = {
  backgroundColor: '#0A2E4D',
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
