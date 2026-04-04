import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast, successBox,
} from './_shared'

export interface OfferAcceptedGuideEmailProps {
  guideName:      string
  anglerName:     string
  location:       string
  confirmedDates: string
  priceEur:       number
  bookingUrl:     string   // /dashboard/bookings/[id]
}

export function OfferAcceptedGuideEmail({
  guideName, anglerName, location, confirmedDates, priceEur, bookingUrl,
}: OfferAcceptedGuideEmailProps) {
  return (
    <EmailLayout preview={`${anglerName} accepted your offer — payment is being processed.`}>
      <Heading style={h1}>Offer accepted — payment processing</Heading>

      <Text style={text}>Hi {guideName},</Text>

      <Text style={text}>
        <strong>{anglerName}</strong> accepted your offer and is completing payment right now.
        You'll receive another notification once the payment is confirmed.
      </Text>

      {/* Status */}
      <Section style={successBox}>
        <Text style={{ color: '#16A34A', fontSize: '14px', fontWeight: 600, margin: 0 }}>
          ✓ Offer accepted — awaiting payment confirmation
        </Text>
      </Section>

      {/* Summary */}
      <Section style={summaryBox}>
        <table width="100%" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={summaryRow}>
              <td style={labelCell}>Angler</td>
              <td style={valueCell}>{anglerName}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Location</td>
              <td style={valueCell}>{location}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Trip dates</td>
              <td style={valueCell}>{confirmedDates}</td>
            </tr>
            <tr style={summaryRowLast}>
              <td style={labelCell}>Trip value</td>
              <td style={{ ...valueCell, color: '#E67E50', fontSize: '16px' }}>€{priceEur}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section style={ctaSection}>
        <Button style={button} href={bookingUrl}>View booking</Button>
      </Section>

      <Text style={textSmall}>
        Once payment clears, the booking status will update to &quot;Confirmed&quot; and you&apos;ll
        get another email. Block those dates in your calendar.
      </Text>
    </EmailLayout>
  )
}
