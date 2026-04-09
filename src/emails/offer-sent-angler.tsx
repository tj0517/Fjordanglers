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

export interface OfferSentAnglerEmailProps {
  anglerName: string
  guideName: string
  experienceTitle: string
  bookingId: string
  offerDates: string[]         // ISO YYYY-MM-DD
  offerPriceEur: number | null
  bookingUrl: string
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function OfferSentAnglerEmail({
  anglerName,
  guideName,
  experienceTitle,
  offerDates,
  offerPriceEur,
  bookingUrl,
}: OfferSentAnglerEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{guideName} proposed new dates — your response needed</Preview>
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
          <Heading style={h1}>New dates proposed</Heading>

          <Text style={text}>
            Hi {anglerName}, <strong>{guideName}</strong> has reviewed your request for{' '}
            <strong>{experienceTitle}</strong> and proposed new dates.
            Please review and respond at your earliest convenience.
          </Text>

          {/* ── Proposed dates ── */}
          <Section style={datesBox}>
            <Text style={datesLabel}>Proposed dates</Text>
            <Text style={datesText}>
              {offerDates.map(fmtDate).join(' · ')}
            </Text>
          </Section>

          {/* ── Offered price (optional) ── */}
          {offerPriceEur != null && offerPriceEur > 0 && (
            <Section style={priceBox}>
              <Text style={priceLabel}>Offered price</Text>
              <Text style={priceText}>€{offerPriceEur.toFixed(2)}</Text>
            </Section>
          )}

          <Text style={text}>
            Log in to accept or decline the guide&apos;s proposal.
            Once you accept, the booking will be confirmed and both parties will be notified.
          </Text>

          {/* ── CTA ── */}
          <Section style={ctaSection}>
            <Button style={button} href={bookingUrl}>
              Review Proposal →
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

const datesBox = {
  backgroundColor: '#FFF7ED',
  border: '1px solid rgba(230,126,80,0.3)',
  borderLeft: '3px solid #E67E50',
  borderRadius: '4px',
  padding: '16px 20px',
  margin: '16px 0 20px',
}

const datesLabel = {
  color: '#C05621',
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

const priceBox = {
  backgroundColor: '#F0FDF4',
  border: '1px solid rgba(34,197,94,0.25)',
  borderRadius: '4px',
  padding: '12px 20px',
  margin: '0 0 20px',
}

const priceLabel = {
  color: '#15803D',
  fontSize: '11px',
  fontWeight: '700' as const,
  letterSpacing: '0.08em',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
}

const priceText = {
  color: '#0A2E4D',
  fontSize: '20px',
  fontWeight: '700' as const,
  margin: '0',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0 24px',
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
