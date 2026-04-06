import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast,
  successBox, noteBox,
} from './_shared'

export interface BookingAcceptedAnglerEmailProps {
  anglerName:       string
  experienceTitle:  string
  guideName:        string
  confirmedDates:   string    // "4 Apr 2026" or "4, 16 & 26 Apr 2026"
  depositEur:       number
  totalEur:         number
  guideNote:        string | null
  bookingUrl:       string    // /account/bookings/[id]
}

export function BookingAcceptedAnglerEmail({
  anglerName, experienceTitle, guideName, confirmedDates,
  depositEur, totalEur, guideNote, bookingUrl,
}: BookingAcceptedAnglerEmailProps) {
  const balanceEur = Math.round((totalEur - depositEur) * 100) / 100

  return (
    <EmailLayout preview={`${guideName} accepted your booking — pay the booking fee to confirm.`}>
      <Heading style={h1}>Booking accepted — pay booking fee</Heading>

      <Text style={text}>Hi {anglerName},</Text>

      <Text style={text}>
        Great news — <strong>{guideName}</strong> has accepted your booking for{' '}
        <strong>{experienceTitle}</strong>. Pay the booking fee now to confirm your spot.
      </Text>

      {/* Confirmation box */}
      <Section style={successBox}>
        <Text style={{ color: '#16A34A', fontSize: '14px', fontWeight: 600, margin: 0 }}>
          ✓ Guide confirmed — your spot is being held
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
              <td style={labelCell}>Booking fee due now</td>
              <td style={{ ...valueCell, color: '#E67E50', fontSize: '16px' }}>€{depositEur}</td>
            </tr>
            {balanceEur > 0 && (
              <tr style={summaryRowLast}>
                <td style={labelCell}>Guide payment</td>
                <td style={valueCell}>€{balanceEur}</td>
              </tr>
            )}
            {balanceEur <= 0 && (
              <tr style={summaryRowLast}>
                <td style={labelCell}>Total</td>
                <td style={valueCell}>€{totalEur}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {guideNote && (
        <Section style={noteBox}>
          <Text style={{ color: '#1D4ED8', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 4px' }}>
            Message from your guide
          </Text>
          <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', margin: 0, whiteSpace: 'pre-wrap' as const }}>
            {guideNote}
          </Text>
        </Section>
      )}

      <Section style={ctaSection}>
        <Button style={button} href={bookingUrl}>
          Pay booking fee — €{depositEur}
        </Button>
      </Section>

      <Text style={textSmall}>
        Your spot is held for 24 hours. If the booking fee is not paid, the booking will be released.
        {balanceEur > 0
          ? ` Instructions for the remaining €${balanceEur} guide payment will be on your booking page.`
          : ''}
      </Text>
    </EmailLayout>
  )
}
