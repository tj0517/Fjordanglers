import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast,
} from './_shared'

export interface BookingRequestAnglerEmailProps {
  anglerName:       string
  experienceTitle:  string
  guideName:        string
  datesLabel:       string   // e.g. "4 Apr 2026" or "4–26 Apr 2026"
  guests:           number
  totalEur:         number
  bookingUrl:       string
}

export function BookingRequestAnglerEmail({
  anglerName, experienceTitle, guideName, datesLabel, guests, totalEur, bookingUrl,
}: BookingRequestAnglerEmailProps) {
  return (
    <EmailLayout preview={`Booking request received — ${guideName} will respond shortly.`}>
      <Heading style={h1}>Your booking request is on its way</Heading>

      <Text style={text}>Hi {anglerName},</Text>

      <Text style={text}>
        Your booking request for <strong>{experienceTitle}</strong> with{' '}
        <strong>{guideName}</strong> has been received.
        The guide will review your request and confirm shortly — you'll get an email with a
        payment link as soon as they accept.
      </Text>

      {/* Summary */}
      <Section style={summaryBox}>
        <table width="100%" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={summaryRow}>
              <td style={labelCell}>Experience</td>
              <td style={valueCell}>{experienceTitle}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Guide</td>
              <td style={valueCell}>{guideName}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Dates</td>
              <td style={valueCell}>{datesLabel}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Group size</td>
              <td style={valueCell}>{guests} {guests === 1 ? 'angler' : 'anglers'}</td>
            </tr>
            <tr style={summaryRowLast}>
              <td style={labelCell}>Total</td>
              <td style={{ ...valueCell, color: '#E67E50', fontSize: '16px' }}>€{totalEur}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section style={ctaSection}>
        <Button style={button} href={bookingUrl}>View your booking</Button>
      </Section>

      <Text style={textSmall}>
        No payment is collected yet. You'll only be charged once the guide confirms your booking.
      </Text>
    </EmailLayout>
  )
}
