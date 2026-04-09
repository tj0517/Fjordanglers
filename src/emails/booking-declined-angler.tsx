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

export interface BookingDeclinedAnglerEmailProps {
  anglerName: string
  guideName: string
  experienceTitle: string
  bookingId: string
  declineReason: string | null
  /** Link to the booking detail page */
  bookingUrl: string
}

export function BookingDeclinedAnglerEmail({
  anglerName,
  guideName,
  experienceTitle,
  declineReason,
  bookingUrl,
}: BookingDeclinedAnglerEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Booking update — {experienceTitle} with {guideName}</Preview>
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
          <Heading style={h1}>Booking not confirmed</Heading>

          <Text style={text}>
            Hi {anglerName}, unfortunately <strong>{guideName}</strong> was unable to
            confirm your booking request for <strong>{experienceTitle}</strong>.
          </Text>

          {/* ── Status badge ── */}
          <Section style={declinedBadge}>
            <Text style={declinedText}>Not confirmed</Text>
          </Section>

          {/* ── Reason from guide ── */}
          {declineReason != null && declineReason.trim() !== '' && (
            <Section style={reasonBox}>
              <Text style={reasonLabel}>Note from {guideName}</Text>
              <Text style={reasonText}>&ldquo;{declineReason}&rdquo;</Text>
            </Section>
          )}

          <Text style={text}>
            Don&apos;t worry — there are many great guides available on FjordAnglers.
            Browse other experiences and find your perfect fishing trip.
          </Text>

          {/* ── CTA ── */}
          <Section style={ctaSection}>
            <Button style={button} href="https://fjordanglers.com/trips">
              Browse Other Experiences →
            </Button>
          </Section>

          <Section style={secondaryCta}>
            <Button style={secondaryButton} href={bookingUrl}>
              View Booking Details
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

const declinedBadge = {
  backgroundColor: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  padding: '12px 20px',
  margin: '16px 0 20px',
  textAlign: 'center' as const,
}

const declinedText = {
  color: '#6B7280',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0',
}

const reasonBox = {
  backgroundColor: '#FAFAFA',
  border: '1px solid #E5E7EB',
  borderLeft: '3px solid #9CA3AF',
  borderRadius: '4px',
  padding: '16px 20px',
  margin: '0 0 24px',
}

const reasonLabel = {
  color: '#6B7280',
  fontSize: '11px',
  fontWeight: '700' as const,
  letterSpacing: '0.08em',
  margin: '0 0 6px',
  textTransform: 'uppercase' as const,
}

const reasonText = {
  color: '#374151',
  fontSize: '15px',
  fontStyle: 'italic' as const,
  lineHeight: '24px',
  margin: '0',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0 12px',
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

const secondaryCta = {
  textAlign: 'center' as const,
  margin: '0 0 24px',
}

const secondaryButton = {
  backgroundColor: 'transparent',
  borderRadius: '8px',
  border: '1.5px solid #D1D5DB',
  color: '#6B7280',
  display: 'inline-block' as const,
  fontSize: '14px',
  fontWeight: '500',
  padding: '10px 24px',
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
