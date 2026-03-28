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

export interface EmailVerificationProps {
  name: string
  confirmUrl: string
}

export function EmailVerificationEmail({ name, confirmUrl }: EmailVerificationProps) {
  return (
    <Html>
      <Head />
      <Preview>Confirm your email to activate your FjordAnglers account.</Preview>
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
          <Heading style={h1}>Confirm your email</Heading>

          <Text style={text}>Hi {name},</Text>

          <Text style={text}>
            Thanks for signing up to FjordAnglers! Click the button below to verify your
            email address and activate your account.
          </Text>

          {/* CTA */}
          <Section style={ctaSection}>
            <Button style={button} href={confirmUrl}>
              Confirm Email
            </Button>
          </Section>

          {/* Security note */}
          <Section style={noteBox}>
            <Text style={noteText}>
              This link expires in <strong>24 hours</strong>. If you didn't create a
              FjordAnglers account, you can safely ignore this email.
            </Text>
          </Section>

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

const ctaSection = {
  textAlign: 'center' as const,
  margin: '8px 0 32px',
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

const noteBox = {
  backgroundColor: '#F0F7FF',
  border: '1px solid #DBEAFE',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 24px',
}

const noteText = {
  color: '#6B7280',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
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
