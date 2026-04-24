import { Heading, Text, Hr } from '@react-email/components'
import { EmailLayout, h1, text, textSmall, summaryBox, labelCell, valueCell, DetailRows, hr, successBox } from './_shared'

export interface BookingConfirmedGuideEmailProps {
  guideName: string
  tripTitle: string
  anglerName: string
  anglerCountry: string
  requestedDates: string[] | null   // YYYY-MM-DD[]
  partySize: number
  inquiryId: string
}

/**
 * Sent to the guide when an angler's deposit is paid and the booking is confirmed.
 * NO financial details — the guide should not see deposit amounts or platform fees.
 */
export function BookingConfirmedGuideEmail({
  guideName,
  tripTitle,
  anglerName,
  anglerCountry,
  requestedDates,
  partySize,
  inquiryId,
}: BookingConfirmedGuideEmailProps) {
  return (
    <EmailLayout preview={`New booking confirmed — ${anglerName} · ${fmtDates(requestedDates)}`}>
      <Heading style={h1}>New booking confirmed</Heading>

      <Text style={text}>
        Hi {guideName}, a booking for <strong>{tripTitle}</strong> has been confirmed.
        FjordAnglers will be in touch with further details.
      </Text>

      <table width="100%" cellPadding={0} cellSpacing={0} style={summaryBox}>
        <tbody>
          <DetailRows rows={[
            { label: 'Angler',      value: `${anglerName} (${anglerCountry})` },
            { label: 'Trip',        value: tripTitle },
            { label: 'Trip dates',  value: fmtDates(requestedDates) },
            { label: 'Party size',  value: `${partySize} ${partySize === 1 ? 'angler' : 'anglers'}` },
            { label: 'Reference',   value: inquiryId, last: true },
          ]} />
        </tbody>
      </table>

      <Text style={text}>
        Please keep these dates available. Our team will contact you shortly to coordinate
        logistics and share the angler&apos;s contact details.
      </Text>

      <Hr style={hr} />
      <Text style={textSmall}>
        Questions? Contact us at contact@fjordanglers.com · Ref: {inquiryId}
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
