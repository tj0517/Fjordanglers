import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast,
  successBox, noteBox, warnBox,
} from './_shared'

export interface BookingConfirmedAnglerEmailProps {
  anglerName:       string
  experienceTitle:  string
  guideName:        string
  confirmedDates:   string
  guests:           number
  amountPaidEur:    number   // deposit paid now (direct) OR full amount (inquiry)
  isPaidInFull:     boolean  // true = inquiry (paid in full), false = direct (deposit only)
  balanceEur:       number   // 0 when isPaidInFull
  balanceMethod:    'stripe' | 'cash' | null
  guidePayoutEur:   number   // used for manual model IBAN instructions
  guideIban:        string | null
  guideIbanHolder:  string | null
  bookingUrl:       string
}

export function BookingConfirmedAnglerEmail({
  anglerName, experienceTitle, guideName, confirmedDates, guests,
  amountPaidEur, isPaidInFull, balanceEur, balanceMethod,
  guidePayoutEur, guideIban, guideIbanHolder, bookingUrl,
}: BookingConfirmedAnglerEmailProps) {
  return (
    <EmailLayout
      preview={
        isPaidInFull
          ? `Booking confirmed — see you on the water with ${guideName}!`
          : `Deposit received — booking confirmed with ${guideName}.`
      }
    >
      <Heading style={h1}>
        {isPaidInFull ? 'Booking confirmed! 🎣' : 'Deposit received — booking confirmed'}
      </Heading>

      <Text style={text}>Hi {anglerName},</Text>

      <Text style={text}>
        {isPaidInFull
          ? `Your booking with ${guideName} is fully confirmed and paid. See you on the water!`
          : `Your deposit has been received and your booking with ${guideName} is confirmed.`}
      </Text>

      {/* Confirmation badge */}
      <Section style={successBox}>
        <Text style={{ color: '#16A34A', fontSize: '14px', fontWeight: 600, margin: 0 }}>
          ✓ {isPaidInFull ? `€${amountPaidEur} paid in full` : `€${amountPaidEur} deposit received`}
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
              <td style={labelCell}>Paid</td>
              <td style={{ ...valueCell, color: '#16A34A' }}>€{amountPaidEur}</td>
            </tr>
            {!isPaidInFull && balanceEur > 0 && (
              <tr style={summaryRowLast}>
                <td style={labelCell}>Balance due</td>
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

      {/* Balance instructions — only for deposit-only (direct booking) */}
      {!isPaidInFull && balanceEur > 0 && (
        <Section style={balanceMethod === 'cash' ? warnBox : noteBox}>
          <Text style={{
            color: balanceMethod === 'cash' ? '#92400E' : '#1D4ED8',
            fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' as const,
            letterSpacing: '0.05em', margin: '0 0 6px',
          }}>
            Balance due before your trip
          </Text>
          {balanceMethod === 'cash' ? (
            <Text style={{ color: '#78350F', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
              The remaining <strong>€{balanceEur}</strong> is due before or on the day of your
              trip. Your guide will collect payment directly.
            </Text>
          ) : (
            <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
              The remaining <strong>€{balanceEur}</strong> will be charged automatically before
              your trip. A payment link is also available in your booking page.
            </Text>
          )}
        </Section>
      )}

      {/* Manual model: guide IBAN */}
      {guideIban && guideIbanHolder && (
        <Section style={noteBox}>
          <Text style={{ color: '#1D4ED8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 6px' }}>
            Pay €{guidePayoutEur} directly to your guide
          </Text>
          <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', margin: '0 0 4px' }}>
            Name: <strong>{guideIbanHolder}</strong>
          </Text>
          <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', fontFamily: 'monospace', margin: 0 }}>
            IBAN: <strong>{guideIban}</strong>
          </Text>
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
