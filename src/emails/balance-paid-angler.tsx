import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection, successBox,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast,
} from './_shared'

export interface BalancePaidAnglerEmailProps {
  anglerName:       string
  experienceTitle:  string
  guideName:        string
  confirmedDates:   string
  guests:           number
  totalEur:         number
  bookingUrl:       string
}

export function BalancePaidAnglerEmail({
  anglerName, experienceTitle, guideName, confirmedDates, guests, totalEur, bookingUrl,
}: BalancePaidAnglerEmailProps) {
  return (
    <EmailLayout preview={`Trip fully paid — see you on the water with ${guideName}!`}>
      <Heading style={h1}>Trip fully paid — see you on the water! 🎣</Heading>

      <Text style={text}>Hi {anglerName},</Text>

      <Text style={text}>
        Your trip with <strong>{guideName}</strong> is fully paid and confirmed.
        Everything is set — we hope you have an incredible time on the water.
      </Text>

      {/* Payment complete */}
      <Section style={successBox}>
        <Text style={{ color: '#16A34A', fontSize: '14px', fontWeight: 600, margin: 0 }}>
          ✓ Trip fully paid — €{totalEur} total
        </Text>
      </Section>

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
              <td style={labelCell}>Trip dates</td>
              <td style={valueCell}>{confirmedDates}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Group size</td>
              <td style={valueCell}>{guests} {guests === 1 ? 'angler' : 'anglers'}</td>
            </tr>
            <tr style={summaryRowLast}>
              <td style={labelCell}>Total paid</td>
              <td style={{ ...valueCell, color: '#16A34A' }}>€{totalEur}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section style={ctaSection}>
        <Button style={button} href={bookingUrl}>View booking</Button>
      </Section>

      <Text style={textSmall}>
        Have questions before your trip? Use the booking chat to message your guide directly.
      </Text>
    </EmailLayout>
  )
}
