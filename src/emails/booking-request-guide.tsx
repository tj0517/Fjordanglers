import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast, noteBox,
} from './_shared'

export interface BookingRequestGuideEmailProps {
  guideName:        string
  anglerName:       string
  anglerEmail:      string
  anglerCountry:    string | null
  experienceTitle:  string
  datesLabel:       string
  guests:           number
  totalEur:         number
  specialRequests:  string | null
  bookingUrl:       string
}

export function BookingRequestGuideEmail({
  guideName, anglerName, anglerEmail, anglerCountry,
  experienceTitle, datesLabel, guests, totalEur, specialRequests, bookingUrl,
}: BookingRequestGuideEmailProps) {
  return (
    <EmailLayout preview={`${anglerName} wants to book ${experienceTitle} with you.`}>
      <Heading style={h1}>New booking request</Heading>

      <Text style={text}>Hi {guideName},</Text>

      <Text style={text}>
        <strong>{anglerName}</strong>
        {anglerCountry ? ` from ${anglerCountry}` : ''}{' '}
        has sent a booking request for <strong>{experienceTitle}</strong>.
        Review the details below and accept or decline from your dashboard.
      </Text>

      {/* Booking summary */}
      <Section style={summaryBox}>
        <table width="100%" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={summaryRow}>
              <td style={labelCell}>Angler</td>
              <td style={valueCell}>{anglerName}{anglerCountry ? ` · ${anglerCountry}` : ''}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Email</td>
              <td style={{ ...valueCell, fontWeight: 400 }}>{anglerEmail}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Experience</td>
              <td style={valueCell}>{experienceTitle}</td>
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
              <td style={labelCell}>Booking value</td>
              <td style={{ ...valueCell, color: '#E67E50', fontSize: '16px' }}>€{totalEur}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {specialRequests && (
        <Section style={noteBox}>
          <Text style={{ ...textSmall, color: '#1D4ED8', fontWeight: 600, margin: '0 0 4px' }}>
            Special requests
          </Text>
          <Text style={{ ...textSmall, margin: 0 }}>{specialRequests}</Text>
        </Section>
      )}

      <Section style={ctaSection}>
        <Button style={button} href={bookingUrl}>Review request</Button>
      </Section>

      <Text style={textSmall}>
        Respond within 24 hours to give anglers the best experience.
        If you can't take this booking, declining promptly helps them plan ahead.
      </Text>
    </EmailLayout>
  )
}
