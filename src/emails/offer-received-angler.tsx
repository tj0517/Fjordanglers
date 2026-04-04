import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast, noteBox,
} from './_shared'

export interface OfferReceivedAnglerEmailProps {
  anglerName:    string
  guideName:     string
  location:      string    // river / assigned location
  offerDates:    string    // e.g. "4, 16 & 26 Apr 2026" or "4–8 Jun 2026"
  priceEur:      number
  offerDetails:  string
  offerUrl:      string    // /account/trips/[id]
}

export function OfferReceivedAnglerEmail({
  anglerName, guideName, location, offerDates, priceEur, offerDetails, offerUrl,
}: OfferReceivedAnglerEmailProps) {
  return (
    <EmailLayout preview={`${guideName} sent you an offer — €${priceEur} for your fishing trip.`}>
      <Heading style={h1}>You have a new offer 🎣</Heading>

      <Text style={text}>Hi {anglerName},</Text>

      <Text style={text}>
        <strong>{guideName}</strong> reviewed your fishing request and sent you an offer.
        Review the details below and accept to confirm your trip.
      </Text>

      {/* Offer summary */}
      <Section style={summaryBox}>
        <table width="100%" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={summaryRow}>
              <td style={labelCell}>Guide</td>
              <td style={valueCell}>{guideName}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Location</td>
              <td style={valueCell}>{location}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Trip dates</td>
              <td style={valueCell}>{offerDates}</td>
            </tr>
            <tr style={summaryRowLast}>
              <td style={labelCell}>Price</td>
              <td style={{ ...valueCell, color: '#E67E50', fontSize: '18px' }}>€{priceEur}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* What's included */}
      <Section style={noteBox}>
        <Text style={{ color: '#1D4ED8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 6px' }}>
          What&apos;s included
        </Text>
        <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', margin: 0, whiteSpace: 'pre-wrap' as const }}>
          {offerDetails}
        </Text>
      </Section>

      <Section style={ctaSection}>
        <Button style={button} href={offerUrl}>View &amp; accept offer</Button>
      </Section>

      <Text style={textSmall}>
        You can ask questions or negotiate details through the booking chat before accepting.
        No payment is charged until you accept.
      </Text>
    </EmailLayout>
  )
}
