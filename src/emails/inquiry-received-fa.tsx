import { Button, Heading, Section, Text, Hr } from '@react-email/components'
import { EmailLayout, h1, text, textSmall, button, ctaSection, summaryBox, labelCell, valueCell, DetailRows, hr } from './_shared'

export interface InquiryReceivedFaEmailProps {
  anglerName: string
  anglerEmail: string
  anglerCountry: string
  tripTitle: string
  requestedDates: string[]   // YYYY-MM-DD[]
  partySize: number
  message: string | null
  inquiryId: string
  dashboardUrl: string    // /dashboard/inquiries/[id]
}

export function InquiryReceivedFaEmail({
  anglerName,
  anglerEmail,
  anglerCountry,
  tripTitle,
  requestedDates,
  partySize,
  message,
  inquiryId,
  dashboardUrl,
}: InquiryReceivedFaEmailProps) {
  return (
    <EmailLayout preview={`New inquiry from ${anglerName} — ${tripTitle}`}>
      <Heading style={h1}>New inquiry received</Heading>

      <Text style={text}>
        A new booking inquiry has been submitted for <strong>{tripTitle}</strong>.
        Review the details below and send a deposit link when ready.
      </Text>

      {/* Summary table */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={summaryBox}>
        <tbody>
          <DetailRows rows={[
            { label: 'Angler',          value: `${anglerName} (${anglerEmail})` },
            { label: 'Country',         value: anglerCountry },
            { label: 'Trip',            value: tripTitle },
            { label: 'Requested dates', value: fmtDates(requestedDates) },
            { label: 'Party size',      value: `${partySize} ${partySize === 1 ? 'angler' : 'anglers'}` },
            { label: 'Inquiry ID',      value: inquiryId, last: true },
          ]} />
        </tbody>
      </table>

      {/* Message */}
      {message != null && message.trim() !== '' && (
        <Section style={messageBox}>
          <Text style={{ ...textSmall, margin: '0 0 6px', fontWeight: 700, color: '#E67E50' }}>
            MESSAGE FROM ANGLER
          </Text>
          <Text style={{ ...text, margin: 0, fontStyle: 'italic' }}>
            &ldquo;{message}&rdquo;
          </Text>
        </Section>
      )}

      <Section style={ctaSection}>
        <Button style={button} href={dashboardUrl}>
          Review &amp; Send Deposit Link →
        </Button>
      </Section>

      <Hr style={hr} />
      <Text style={textSmall}>
        Inquiry ID: {inquiryId} · Status: pending_fa_review
      </Text>
    </EmailLayout>
  )
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDates(dates: string[]): string {
  if (dates.length === 0) return 'Not specified'
  return dates.map(fmtDate).join(', ')
}

const messageBox = {
  backgroundColor: '#FFFBF7',
  border: '1px solid rgba(230,126,80,0.25)',
  borderLeft: '3px solid #E67E50',
  borderRadius: '4px',
  padding: '16px 20px',
  margin: '0 0 24px',
}
