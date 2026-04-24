import { Button, Heading, Section, Text, Hr } from '@react-email/components'
import { EmailLayout, h1, text, textSmall, button, ctaSection, summaryBox, labelCell, valueCell, DetailRows, hr, warnBox } from './_shared'

export interface DepositLinkAnglerEmailProps {
  anglerName: string
  tripTitle: string
  requestedDates: string[]   // YYYY-MM-DD[]
  partySize: number
  depositAmountEur: number   // e.g. 300
  depositPercent: number     // e.g. 30
  checkoutUrl: string
  inquiryId: string
}

export function DepositLinkAnglerEmail({
  anglerName,
  tripTitle,
  requestedDates,
  partySize,
  depositAmountEur,
  depositPercent,
  checkoutUrl,
  inquiryId,
}: DepositLinkAnglerEmailProps) {
  return (
    <EmailLayout preview={`Action required — secure your booking for ${tripTitle}`}>
      <Heading style={h1}>Secure your booking</Heading>

      <Text style={text}>
        Hi {anglerName}, great news — we&apos;ve confirmed availability for <strong>{tripTitle}</strong>.
        To secure your booking, please pay the{' '}
        <strong>{depositPercent}% Booking &amp; Curation Fee (€{depositAmountEur.toFixed(2)})</strong>{' '}
        via the link below.
      </Text>

      {/* Booking summary */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={summaryBox}>
        <tbody>
          <DetailRows rows={[
            { label: 'Trip',        value: tripTitle },
            { label: 'Trip dates',  value: fmtDates(requestedDates) },
            { label: 'Party size',  value: `${partySize} ${partySize === 1 ? 'angler' : 'anglers'}` },
            { label: 'Deposit due', value: `€${depositAmountEur.toFixed(2)} (${depositPercent}%)`, last: true },
          ]} />
        </tbody>
      </table>

      {/* Note about balance */}
      <Section style={warnBox}>
        <Text style={{ ...textSmall, margin: 0, fontWeight: 600, color: '#92400E' }}>
          💡 &nbsp;The remaining balance will be paid directly to the guide on or before the trip date.
          FjordAnglers retains the deposit as a Booking &amp; Curation Fee.
        </Text>
      </Section>

      <Section style={ctaSection}>
        <Button style={button} href={checkoutUrl}>
          Pay Deposit — €{depositAmountEur.toFixed(2)} →
        </Button>
      </Section>

      <Text style={textSmall}>
        This link expires after 24 hours. If you have any questions, reply to this email.
      </Text>

      <Hr style={hr} />
      <Text style={textSmall}>Reference: {inquiryId}</Text>
    </EmailLayout>
  )
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDates(dates: string[]): string {
  if (dates.length === 0) return 'To be confirmed'
  return dates.map(fmtDate).join(', ')
}
