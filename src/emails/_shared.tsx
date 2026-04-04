/**
 * _shared.tsx — shared layout, styles, and helpers for all booking emails.
 *
 * Import EmailLayout as a wrapper component.
 * Import individual style constants as needed.
 */

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// ─── Layout component ─────────────────────────────────────────────────────────

export function EmailLayout({
  preview,
  children,
}: {
  preview: string
  children: React.ReactNode
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Section style={header}>
          <Img
            src="https://fjordanglers.com/brand/white-logo.png"
            width={160}
            alt="FjordAnglers"
            style={{ display: 'block', margin: '0 auto', width: '160px', height: 'auto' }}
          />
        </Section>
        <Container style={container}>
          {children}
          <Hr style={hr} />
          <Text style={footerSmall}>
            FjordAnglers · Connecting guides &amp; anglers across Scandinavia
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

export const body = {
  backgroundColor: '#F8FAFB',
  margin: 0,
  padding: 0,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif',
}

export const header = {
  backgroundColor: '#0A2E4D',
  padding: '28px 40px',
}

export const container = {
  backgroundColor: '#FFFFFF',
  margin: '0 auto',
  maxWidth: '600px',
  padding: '40px 48px 32px',
}

export const h1 = {
  color: '#0A2E4D',
  fontSize: '26px',
  fontWeight: '700',
  lineHeight: '1.25',
  margin: '0 0 20px',
}

export const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
}

export const textSmall = {
  color: '#6B7280',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 12px',
}

export const button = {
  backgroundColor: '#E67E50',
  borderRadius: '8px',
  color: '#FFFFFF',
  display: 'inline-block' as const,
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
}

export const ctaSection = {
  textAlign: 'center' as const,
  margin: '28px 0',
}

export const summaryBox = {
  backgroundColor: '#F8FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  padding: '0',
  margin: '24px 0',
}

export const summaryRow = {
  borderBottom: '1px solid #E5E7EB',
  padding: '10px 20px',
}

export const summaryRowLast = {
  padding: '10px 20px',
}

export const labelCell = {
  color: '#6B7280',
  fontSize: '12px',
  fontWeight: 600 as const,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  paddingRight: '16px',
  verticalAlign: 'top' as const,
  whiteSpace: 'nowrap' as const,
  width: '36%',
}

export const valueCell = {
  color: '#0A2E4D',
  fontSize: '14px',
  fontWeight: 600 as const,
  verticalAlign: 'top' as const,
}

export const noteBox = {
  backgroundColor: '#F0F7FF',
  border: '1px solid #DBEAFE',
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '0 0 24px',
}

export const successBox = {
  backgroundColor: '#F0FDF4',
  border: '1px solid #BBF7D0',
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '0 0 24px',
}

export const warnBox = {
  backgroundColor: '#FFFBEB',
  border: '1px solid #FDE68A',
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '0 0 24px',
}

export const hr = {
  border: 'none',
  borderTop: '1px solid #E5E7EB',
  margin: '32px 0 24px',
}

export const footerSmall = {
  color: '#9CA3AF',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0',
}

// ─── Detail table helper ───────────────────────────────────────────────────────
// Used inside <table> elements in templates.

export function DetailRows({
  rows,
}: {
  rows: { label: string; value: string; last?: boolean }[]
}) {
  return (
    <>
      {rows.map(({ label, value, last }, i) => (
        <tr key={i} style={last ? summaryRowLast : summaryRow}>
          <td style={labelCell}>{label}</td>
          <td style={valueCell}>{value}</td>
        </tr>
      ))}
    </>
  )
}
