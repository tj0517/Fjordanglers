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

export interface InquiryRequestGuideEmailProps {
  guideName: string
  anglerName: string
  anglerEmail: string
  experienceTitle: string
  inquiryId: string
  periods: Array<{ from: string; to: string }>
  individualDates: string[]
  guests: number
  labeledAnswers: Array<{ label: string; answer: string }>
  notes: string | null
  durationPreference?: string | null
  inquiryUrl: string
}

export function InquiryRequestGuideEmail({
  guideName,
  anglerName,
  anglerEmail,
  experienceTitle,
  periods,
  individualDates,
  guests,
  labeledAnswers,
  notes,
  durationPreference,
  inquiryUrl,
}: InquiryRequestGuideEmailProps) {
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
      <Preview>New trip enquiry from {anglerName} — {experienceTitle}</Preview>
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
          <Heading style={h1}>New trip enquiry 🎣</Heading>

          <Text style={text}>
            Hi {guideName}, <strong>{anglerName}</strong> has sent you an enquiry about{' '}
            <strong>{experienceTitle}</strong>.
          </Text>

          {/* ── Summary box ── */}
          <Section style={summaryBox}>
            <Text style={summaryRow}>
              <span style={summaryLabel}>Angler</span>
              <span style={summaryValue}>{anglerName} · {anglerEmail}</span>
            </Text>

            <Hr style={summaryHr} />

            <Text style={summaryRow}>
              <span style={summaryLabel}>Group size</span>
              <span style={summaryValue}>{guests} {guests === 1 ? 'angler' : 'anglers'}</span>
            </Text>

            <Hr style={summaryHr} />

            {/* Availability periods */}
            <Text style={{ ...summaryRow, display: 'block' as const }}>
              <span style={{ ...summaryLabel, display: 'block' as const, marginBottom: '6px' }}>
                Available periods
              </span>
              {availabilityLines.map((line, i) => (
                <span key={i} style={{ ...summaryValue, display: 'block' as const }}>
                  • {line}
                </span>
              ))}
            </Text>

            {/* Trip duration preference */}
            {durationPreference != null && durationPreference.trim() !== '' && (
              <>
                <Hr style={summaryHr} />
                <Text style={summaryRow}>
                  <span style={summaryLabel}>Preferred trip length</span>
                  <span style={summaryValue}>{durationPreference}</span>
                </Text>
              </>
            )}

            {/* Custom field answers */}
            {labeledAnswers.map(({ label, answer }) => (
              <span key={label}>
                <Hr style={summaryHr} />
                <Text style={summaryRow}>
                  <span style={summaryLabel}>{label}</span>
                  <span style={summaryValue}>{answer}</span>
                </Text>
              </span>
            ))}
          </Section>

          {/* ── Notes ── */}
          {notes != null && notes.trim() !== '' && (
            <Section style={notesBox}>
              <Text style={notesLabel}>Notes from angler</Text>
              <Text style={notesText}>&ldquo;{notes}&rdquo;</Text>
            </Section>
          )}

          <Text style={text}>
            Log in to your dashboard to review this enquiry and send your offer back.
          </Text>

          {/* ── CTA ── */}
          <Section style={ctaSection}>
            <Button style={button} href={inquiryUrl}>
              View Enquiry →
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footerText}>
            This enquiry is waiting for your response. Reply within 48 hours.
          </Text>
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

const notesBox = {
  backgroundColor: '#FFFBF7',
  border: '1px solid rgba(230,126,80,0.25)',
  borderLeft: '3px solid #E67E50',
  borderRadius: '4px',
  padding: '16px 20px',
  margin: '0 0 24px',
}

const notesLabel = {
  color: '#E67E50',
  fontSize: '11px',
  fontWeight: '700' as const,
  letterSpacing: '0.08em',
  margin: '0 0 6px',
  textTransform: 'uppercase' as const,
}

const notesText = {
  color: '#374151',
  fontSize: '15px',
  fontStyle: 'italic' as const,
  lineHeight: '24px',
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
  margin: '0 0 8px',
  textAlign: 'center' as const,
}

const footerSmall = {
  color: '#9CA3AF',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0',
}
