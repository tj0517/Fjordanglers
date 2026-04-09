import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Button,
} from '@react-email/components'

export interface InquiryRequestAnglerEmailProps {
  anglerName: string
  guideName: string
  experienceTitle: string
  inquiryId: string
  periods: Array<{ from: string; to: string }>
  individualDates: string[]
  guests: number
  inquiryUrl: string
}

export function InquiryRequestAnglerEmail({
  anglerName,
  guideName,
  experienceTitle,
  periods,
  individualDates,
  guests,
  inquiryUrl,
}: InquiryRequestAnglerEmailProps) {
  const availabilityLines = [
    ...periods.map(p =>
      p.from === p.to
        ? fmtDate(p.from)
        : `${fmtDate(p.from)} – ${fmtDate(p.to)}`
    ),
    ...individualDates.map(d => fmtDate(d)),
  ]

  return (
    <Html>
      <Head />
      <Preview>Your enquiry to {guideName} has been sent — {experienceTitle}</Preview>
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
          <Heading style={h1}>Enquiry sent! 🎣</Heading>

          <Text style={text}>
            Hi {anglerName}, your enquiry for <strong>{experienceTitle}</strong> has been
            sent to <strong>{guideName}</strong>. They will get back to you shortly.
          </Text>

          {/* ── Summary box ── */}
          <Section style={summaryBox}>
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
              <span style={summaryLabel}>Group size</span>
              <span style={summaryValue}>{guests} {guests === 1 ? 'angler' : 'anglers'}</span>
            </Text>
            <Hr style={summaryHr} />

            {/* Availability */}
            <Text style={{ ...summaryRow, display: 'block' as const }}>
              <span style={{ ...summaryLabel, display: 'block' as const, marginBottom: '6px' }}>
                Your availability
              </span>
              {availabilityLines.map((line, i) => (
                <span key={i} style={{ ...summaryValue, display: 'block' as const }}>
                  • {line}
                </span>
              ))}
            </Text>
          </Section>

          {/* ── What happens next ── */}
          <Section style={nextBox}>
            <Text style={nextTitle}>What happens next?</Text>
            <Text style={nextItem}>1. {guideName} reviews your enquiry</Text>
            <Text style={nextItem}>2. They confirm availability and send you an offer</Text>
            <Text style={nextItem}>3. You agree on the details and confirm your trip</Text>
          </Section>

          <Text style={text}>
            You can view and manage your enquiry in your account at any time.
          </Text>

          <Section style={ctaSection}>
            <Button style={button} href={inquiryUrl}>
              View Your Enquiry →
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footerSmall}>
            FjordAnglers · Connecting guides &amp; anglers across Scandinavia
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ── Date helper ────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
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

const summaryBox = {
  backgroundColor: '#F8FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  padding: '20px 24px',
  margin: '24px 0',
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

const nextBox = {
  backgroundColor: 'rgba(10,46,77,0.04)',
  border: '1px solid rgba(10,46,77,0.1)',
  borderRadius: '8px',
  padding: '20px 24px',
  margin: '0 0 24px',
}

const nextTitle = {
  color: '#0A2E4D',
  fontSize: '14px',
  fontWeight: '700' as const,
  margin: '0 0 12px',
}

const nextItem = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 6px',
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

const footerSmall = {
  color: '#9CA3AF',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0',
}
