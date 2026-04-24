import { Heading, Text, Hr } from '@react-email/components'
import { EmailLayout, h1, text, textSmall, summaryBox, labelCell, valueCell, DetailRows, hr, successBox } from './_shared'

export interface DepositConfirmedFaEmailProps {
  anglerName: string
  anglerEmail: string
  tripTitle: string
  requestedDates: string[] | null   // YYYY-MM-DD[]
  partySize: number
  depositAmountEur: number
  stripeSessionId: string
  inquiryId: string
}

export function DepositConfirmedFaEmail({
  anglerName,
  anglerEmail,
  tripTitle,
  requestedDates,
  partySize,
  depositAmountEur,
  stripeSessionId,
  inquiryId,
}: DepositConfirmedFaEmailProps) {
  return (
    <EmailLayout preview={`Deposit received — ${tripTitle} — €${depositAmountEur.toFixed(2)}`}>
      <Heading style={h1}>Deposit received</Heading>

      <Text style={text}>
        <strong>€{depositAmountEur.toFixed(2)}</strong> deposit has been successfully paid for{' '}
        <strong>{tripTitle}</strong>. The booking is now confirmed.
      </Text>

      <table width="100%" cellPadding={0} cellSpacing={0} style={summaryBox}>
        <tbody>
          <DetailRows rows={[
            { label: 'Angler',         value: `${anglerName} (${anglerEmail})` },
            { label: 'Trip',           value: tripTitle },
            { label: 'Trip dates',     value: fmtDates(requestedDates) },
            { label: 'Party size',     value: `${partySize} ${partySize === 1 ? 'angler' : 'anglers'}` },
            { label: 'Deposit',        value: `€${depositAmountEur.toFixed(2)}` },
            { label: 'Stripe session', value: stripeSessionId },
            { label: 'Inquiry ID',     value: inquiryId, last: true },
          ]} />
        </tbody>
      </table>

      <Hr style={hr} />
      <Text style={textSmall}>
        Next step: send guide confirmation with trip details (no financial info).
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
