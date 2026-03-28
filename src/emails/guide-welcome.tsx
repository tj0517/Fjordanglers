import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'

export interface GuideWelcomeEmailProps {
  name: string
  dashboardUrl: string
}

export function GuideWelcomeEmail({ name, dashboardUrl }: GuideWelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to FjordAnglers, {name}! Your guide account is ready.</Preview>
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
          <Heading style={h1}>Welcome, {name}!</Heading>

          <Text style={text}>
            Your FjordAnglers guide account is ready. You're now part of a growing community of
            Scandinavian fishing guides connecting with anglers from across Europe.
          </Text>

          {/* Steps */}
          <Section style={stepsWrapper}>
            <Text style={stepsHeading}>Get started in 3 steps</Text>

            <Row style={step}>
              <Column style={stepLeft}>
                <Text style={stepNum}>1</Text>
              </Column>
              <Column style={stepRight}>
                <Text style={stepTitle}>Complete your profile</Text>
                <Text style={stepDesc}>Add your photo, bio, fish expertise, and languages.</Text>
              </Column>
            </Row>

            <Row style={step}>
              <Column style={stepLeft}>
                <Text style={stepNum}>2</Text>
              </Column>
              <Column style={stepRight}>
                <Text style={stepTitle}>Connect Stripe for payouts</Text>
                <Text style={stepDesc}>Link your bank account so you can receive booking payments.</Text>
              </Column>
            </Row>

            <Row style={step}>
              <Column style={stepLeft}>
                <Text style={stepNum}>3</Text>
              </Column>
              <Column style={stepRight}>
                <Text style={stepTitle}>Create your first experience</Text>
                <Text style={stepDesc}>List your fishing trips and start receiving bookings.</Text>
              </Column>
            </Row>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Button style={button} href={dashboardUrl}>
              Go to Dashboard
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footerText}>
            Questions? Reply to this email — we're here to help every step of the way.
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

const stepsWrapper = {
  backgroundColor: '#F8FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  padding: '20px 24px',
  margin: '24px 0',
}

const stepsHeading = {
  color: '#0A2E4D',
  fontSize: '14px',
  fontWeight: '700',
  letterSpacing: '0.04em',
  margin: '0 0 16px',
  textTransform: 'uppercase' as const,
}

const step = {
  marginBottom: '16px',
}

const stepLeft = {
  width: '44px',
  verticalAlign: 'top' as const,
}

const stepNum = {
  backgroundColor: '#E67E50',
  borderRadius: '50%',
  color: '#FFFFFF',
  display: 'inline-block' as const,
  fontSize: '13px',
  fontWeight: '700',
  height: '28px',
  lineHeight: '28px',
  margin: '0',
  textAlign: 'center' as const,
  width: '28px',
}

const stepRight = {
  paddingLeft: '12px',
  verticalAlign: 'top' as const,
}

const stepTitle = {
  color: '#0A2E4D',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0 0 2px',
  lineHeight: '1.4',
}

const stepDesc = {
  color: '#6B7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
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
  margin: '0 0 12px',
  textAlign: 'center' as const,
}

const footerSmall = {
  color: '#9CA3AF',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0',
}
