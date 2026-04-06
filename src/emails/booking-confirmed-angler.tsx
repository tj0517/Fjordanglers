import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast,
  successBox, noteBox,
} from './_shared'

export interface BookingConfirmedAnglerEmailProps {
  anglerName:       string
  experienceTitle:  string
  guideName:        string
  confirmedDates:   string
  guests:           number
  amountPaidEur:    number   // booking fee paid (direct) OR full amount (inquiry)
  isPaidInFull:     boolean  // true = inquiry (paid in full), false = direct (booking fee only)
  balanceEur:       number   // 0 when isPaidInFull
  /** True when guide has active Stripe Connect — angler pays guide via second Stripe Checkout */
  isStripeConnect:  boolean
  guidePayoutEur:   number   // guide payment amount (used for IBAN instructions)
  /** True when guide has IBAN configured (manual model only) */
  guideHasIban:     boolean
  bookingUrl:       string
}

export function BookingConfirmedAnglerEmail({
  anglerName, experienceTitle, guideName, confirmedDates, guests,
  amountPaidEur, isPaidInFull, balanceEur, isStripeConnect,
  guidePayoutEur, guideHasIban, bookingUrl,
}: BookingConfirmedAnglerEmailProps) {
  return (
    <EmailLayout
      preview={
        isPaidInFull
          ? `Booking confirmed — see you on the water with ${guideName}!`
          : `Booking fee received — booking confirmed with ${guideName}.`
      }
    >
      <Heading style={h1}>
        {isPaidInFull ? 'Booking confirmed! 🎣' : 'Booking fee received — booking confirmed'}
      </Heading>

      <Text style={text}>Hi {anglerName},</Text>

      <Text style={text}>
        {isPaidInFull
          ? `Your booking with ${guideName} is fully confirmed and paid. See you on the water!`
          : `Your booking fee has been received and your booking with ${guideName} is confirmed.`}
      </Text>

      {/* Confirmation badge */}
      <Section style={successBox}>
        <Text style={{ color: '#16A34A', fontSize: '14px', fontWeight: 600, margin: 0 }}>
          ✓ {isPaidInFull ? `€${amountPaidEur} paid in full` : `€${amountPaidEur} booking fee received`}
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
            <tr style={summaryRow}>
              <td style={labelCell}>Booking fee paid</td>
              <td style={{ ...valueCell, color: '#16A34A' }}>€{amountPaidEur}</td>
            </tr>
            {!isPaidInFull && balanceEur > 0 && (
              <tr style={summaryRowLast}>
                <td style={labelCell}>Guide payment</td>
                <td style={{ ...valueCell, color: '#E67E50' }}>€{balanceEur}</td>
              </tr>
            )}
            {isPaidInFull && (
              <tr style={summaryRowLast}>
                <td style={labelCell}>Status</td>
                <td style={{ ...valueCell, color: '#16A34A' }}>Fully paid</td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* Guide payment instructions — direct bookings only */}
      {!isPaidInFull && balanceEur > 0 && (
        <Section style={noteBox}>
          <Text style={{
            color: '#1D4ED8',
            fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' as const,
            letterSpacing: '0.05em', margin: '0 0 6px',
          }}>
            Guide payment — €{guidePayoutEur}
          </Text>

          {isStripeConnect ? (
            /* Stripe Connect: angler pays guide via second Stripe Checkout on booking page */
            <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
              Pay <strong>€{guidePayoutEur}</strong> to your guide securely via Stripe —
              use the payment button on your <a href={bookingUrl} style={{ color: '#1D4ED8' }}>booking page</a>.
            </Text>
          ) : guideHasIban ? (
            /* Manual model with IBAN: guide will share details via booking chat */
            <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
              Your guide will share bank transfer details for <strong>€{guidePayoutEur}</strong>{' '}
              via the booking chat. Check your{' '}
              <a href={bookingUrl} style={{ color: '#1D4ED8' }}>booking page</a> for the payment
              instructions.
            </Text>
          ) : (
            /* Manual model without IBAN: arrange via chat */
            <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
              Arrange payment of <strong>€{guidePayoutEur}</strong> directly with{' '}
              <strong>{guideName}</strong> — use the booking chat to agree on the method
              (cash, bank transfer, Vipps, etc.).
            </Text>
          )}
        </Section>
      )}

      <Section style={ctaSection}>
        <Button style={button} href={bookingUrl}>View booking</Button>
      </Section>

      <Text style={textSmall}>
        If you have any questions, reply to this email or message your guide directly through the
        booking chat.
      </Text>
    </EmailLayout>
  )
}
