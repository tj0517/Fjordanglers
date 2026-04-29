import { Heading, Section, Text, Hr } from '@react-email/components'
import { EmailLayout, h1, text, textSmall, summaryBox, labelCell, valueCell, DetailRows, hr, successBox } from './_shared'

export interface DepositConfirmedAnglerEmailProps {
  anglerName: string
  tripTitle: string
  requestedDates: string[] | null   // YYYY-MM-DD[]
  partySize: number
  depositAmountEur: number
  inquiryId: string
}

export function DepositConfirmedAnglerEmail({
  anglerName,
  tripTitle,
  requestedDates,
  partySize,
  depositAmountEur,
  inquiryId,
}: DepositConfirmedAnglerEmailProps) {
  return (
    <EmailLayout preview={`Booking confirmed — ${tripTitle}`}>
      <Heading style={h1}>Booking confirmed! 🎣</Heading>

      <Text style={text}>
        Hi {anglerName}, your deposit has been received and your booking for{' '}
        <strong>{tripTitle}</strong> is now confirmed. We&apos;re looking forward to your trip!
      </Text>

      {/* Confirmed badge */}
      <Section style={successBox}>
        <Text style={{ ...textSmall, margin: 0, fontWeight: 700, color: '#166534' }}>
          ✅ &nbsp;Deposit of €{depositAmountEur.toFixed(2)} received — booking confirmed
        </Text>
      </Section>

      {/* Booking summary */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={summaryBox}>
        <tbody>
          <DetailRows rows={[
            { label: 'Trip',         value: tripTitle },
            { label: 'Trip dates',   value: fmtDates(requestedDates) },
            { label: 'Party size',   value: `${partySize} ${partySize === 1 ? 'angler' : 'anglers'}` },
            { label: 'Deposit paid', value: `€${depositAmountEur.toFixed(2)}` },
            { label: 'Reference',    value: inquiryId, last: true },
          ]} />
        </tbody>
      </table>

      <Text style={text}>
        <strong>What happens next?</strong>
      </Text>
      <Text style={text}>
        Our team will be in touch with full trip details, the guide&apos;s contact information,
        and instructions for paying the remaining balance. The balance is paid directly to the
        guide — not through FjordAnglers.
      </Text>

      <Hr style={hr} />
      <Text style={textSmall}>
        Questions? Reply to this email and we&apos;ll help. Reference: {inquiryId}
      </Text>
    </EmailLayout>
  )
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDates(dates: string[] | null): string {
  if (dates == null || dates.length === 0) return 'To be confirmed'
  return dates.map(fmtDate).join(', ')
}
