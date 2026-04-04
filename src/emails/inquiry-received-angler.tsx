import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast, noteBox,
} from './_shared'

export interface InquiryReceivedAnglerEmailProps {
  anglerName:   string
  guideName:    string
  datesLabel:   string      // e.g. "Jun 14 – Jun 28 2026"
  species:      string[]
  guests:       number
  notes:        string | null
  tripUrl:      string      // /account/trips/[id]
}

export function InquiryReceivedAnglerEmail({
  anglerName, guideName, datesLabel, species, guests, notes, tripUrl,
}: InquiryReceivedAnglerEmailProps) {
  return (
    <EmailLayout preview={`Your fishing request has been sent to ${guideName}.`}>
      <Heading style={h1}>Your fishing request is on its way</Heading>

      <Text style={text}>Hi {anglerName},</Text>

      <Text style={text}>
        We've forwarded your fishing request to <strong>{guideName}</strong>.
        They'll review it and get back to you with an offer — usually within 24 hours.
      </Text>

      {/* Summary */}
      <Section style={summaryBox}>
        <table width="100%" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={summaryRow}>
              <td style={labelCell}>Guide</td>
              <td style={valueCell}>{guideName}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Availability</td>
              <td style={valueCell}>{datesLabel}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Target species</td>
              <td style={valueCell}>{species.join(', ')}</td>
            </tr>
            <tr style={summaryRowLast}>
              <td style={labelCell}>Group size</td>
              <td style={valueCell}>{guests} {guests === 1 ? 'angler' : 'anglers'}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {notes && (
        <Section style={noteBox}>
          <Text style={{ color: '#1D4ED8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 4px' }}>
            Your notes
          </Text>
          <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
            {notes}
          </Text>
        </Section>
      )}

      <Section style={ctaSection}>
        <Button style={button} href={tripUrl}>View your request</Button>
      </Section>

      <Text style={textSmall}>
        You'll receive an email when {guideName} sends you an offer.
        No payment is required at this stage.
      </Text>
    </EmailLayout>
  )
}
