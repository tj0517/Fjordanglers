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

export interface GuideApplicationEmailProps {
  name: string
  plan: 'listing' | 'bookable' | 'founding'
  country: string
}

const planLabel: Record<GuideApplicationEmailProps['plan'], string> = {
  listing: 'Listing (free)',
  bookable: 'Commission — 10%',
  founding: 'Founding Guide — 8% commission',
}

export function GuideApplicationEmail({ name, plan, country }: GuideApplicationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>We received your application — we'll be in touch within 3–5 business days.</Preview>
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
          <Heading style={h1}>Application received!</Heading>

          <Text style={text}>Hi {name},</Text>

          <Text style={text}>
            Thanks for applying to become a FjordAnglers guide. We're excited to review your
            profile and help you connect with anglers from across Europe.
          </Text>

          {/* Info box */}
          <Section style={infoBox}>
            <Text style={infoLabel}>Plan selected</Text>
            <Text style={infoValue}>{planLabel[plan]}</Text>
            <Hr style={infoHr} />
            <Text style={infoLabel}>Country</Text>
            <Text style={infoValue}>{country}</Text>
          </Section>

          <Text style={text}>
            <strong>What happens next</strong>
          </Text>
          <Text style={text}>
            Our team reviews every application manually. If everything looks good we'll reach
            out with a personal invite link to claim your guide profile — usually within
            3–5 business days.
          </Text>
          <Text style={text}>
            Questions? Just reply to this email.
          </Text>

          <Hr style={hr} />

          <Text style={footerText}>
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
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '1.2',
  margin: '0 0 24px',
}

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
}

const infoBox = {
  backgroundColor: '#F8FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  padding: '20px 24px',
  margin: '24px 0',
}

const infoLabel = {
  color: '#6B7280',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.06em',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
}

const infoValue = {
  color: '#0A2E4D',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 16px',
}

const infoHr = {
  border: 'none',
  borderTop: '1px solid #E5E7EB',
  margin: '12px 0',
}

const hr = {
  border: 'none',
  borderTop: '1px solid #E5E7EB',
  margin: '32px 0 24px',
}

const footerText = {
  color: '#9CA3AF',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0',
}
