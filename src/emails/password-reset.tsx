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

export interface PasswordResetEmailProps {
  resetUrl: string
}

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your FjordAnglers password — link valid for 1 hour.</Preview>
      <Body style={body}>

        {/* ── Header ── */}
        <Section style={header}>
          <Img
            src="https://fjordanglers.com/brand/white-logo.png"
            width={160}
            height={40}
            alt="FjordAnglers"
            style={{ display: 'block', margin: '0 auto' }}
          />
        </Section>

        {/* ── Content ── */}
        <Container style={container}>
          <Heading style={h1}>Reset your password</Heading>

          <Text style={text}>
            We received a request to reset the password for your FjordAnglers account.
            Click the button below to choose a new password.
          </Text>

          {/* CTA */}
          <Section style={ctaSection}>
            <Button style={button} href={resetUrl}>
              Reset Password
            </Button>
          </Section>

          {/* Security note */}
          <Section style={noteBox}>
            <Text style={noteText}>
              This link expires in <strong>1 hour</strong>. If you didn't request a password
              reset, you can safely ignore this email — your password will remain unchanged.
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
  margin: '0 0 24px',
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
  backgroundColor: '#FFF8F5',
  border: '1px solid #FDE8DC',
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
