import { Heading, Section, Text, Hr } from '@react-email/components'
import { EmailLayout, h1, text, textSmall, summaryBox, labelCell, valueCell, DetailRows, hr, successBox } from './_shared'

export interface InquiryReceivedAnglerEmailProps {
  anglerName: string
  tripTitle: string
  requestedDates: string[]   // YYYY-MM-DD[]
  partySize: number
  inquiryId: string
}

export function InquiryReceivedAnglerEmail({
  anglerName,
  tripTitle,
  requestedDates,
  partySize,
  inquiryId,
}: InquiryReceivedAnglerEmailProps) {
  return (
    <EmailLayout preview={`Your inquiry for ${tripTitle} has been received`}>
      <Heading style={h1}>Inquiry received!</Heading>

      <Text style={text}>
        Hi {anglerName},&nbsp; we&apos;ve received your inquiry for <strong>{tripTitle}</strong>.
        Our team will review it and get back to you within 24 hours.
      </Text>

      {/* Status badge */}
      <Section style={successBox}>
        <Text style={{ ...textSmall, margin: 0, fontWeight: 700, color: '#166534' }}>
          ✅ &nbsp;Your inquiry has been received by FjordAnglers. We&apos;ll be in touch within 24 hours.
        </Text>
      </Section>

      {/* Summary */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={summaryBox}>
        <tbody>
          <DetailRows rows={[
            { label: 'Trip',            value: tripTitle },
            { label: 'Requested dates', value: fmtDates(requestedDates) },
            { label: 'Party size',      value: `${partySize} ${partySize === 1 ? 'angler' : 'anglers'}` },
            { label: 'Reference',       value: inquiryId, last: true },
          ]} />
        </tbody>
      </table>

      <Text style={text}>
        Once we&apos;ve confirmed availability with the guide, we&apos;ll send you a secure deposit link.
        No payment is required at this stage.
      </Text>

      <Hr style={hr} />
      <Text style={textSmall}>
        Questions? Reply to this email and we&apos;ll get back to you.
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
