import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast, successBox,
} from './_shared'

export interface BookingConfirmedGuideEmailProps {
  guideName:        string
  anglerName:       string
  anglerEmail:      string
  anglerPhone:      string | null
  experienceTitle:  string
  confirmedDates:   string
  guests:           number
  guidePayoutEur:   number
  isPaidInFull:     boolean  // inquiry = true (full payout), direct = false (after balance)
  bookingUrl:       string
}

export function BookingConfirmedGuideEmail({
  guideName, anglerName, anglerEmail, anglerPhone,
  experienceTitle, confirmedDates, guests, guidePayoutEur, isPaidInFull, bookingUrl,
}: BookingConfirmedGuideEmailProps) {
  return (
    <EmailLayout
      preview={`${anglerName}'s booking is confirmed — ${isPaidInFull ? 'fully paid' : 'deposit received'}.`}
    >
      <Heading style={h1}>
        {isPaidInFull ? 'Booking confirmed — paid in full' : 'Booking confirmed — deposit received'}
      </Heading>

      <Text style={text}>Hi {guideName},</Text>

      <Text style={text}>
        <strong>{anglerName}</strong> has confirmed their booking for{' '}
        <strong>{experienceTitle}</strong>.{' '}
        {isPaidInFull
          ? 'Full payment has been processed.'
          : 'The deposit has been received — balance is due before the trip.'}
      </Text>

      {/* Payment confirmation */}
      <Section style={successBox}>
        <Text style={{ color: '#16A34A', fontSize: '14px', fontWeight: 600, margin: 0 }}>
          ✓ {isPaidInFull ? `€${guidePayoutEur} payout scheduled` : 'Deposit received — balance pending'}
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
              <td style={labelCell}>Contact</td>
              <td style={{ ...valueCell, fontWeight: 400 }}>
                {anglerEmail}
                {anglerPhone ? ` · ${anglerPhone}` : ''}
              </td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Experience</td>
              <td style={valueCell}>{experienceTitle}</td>
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
              <td style={labelCell}>Your payout</td>
              <td style={{ ...valueCell, color: '#16A34A', fontSize: '16px' }}>€{guidePayoutEur}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section style={ctaSection}>
        <Button style={button} href={bookingUrl}>View booking</Button>
      </Section>

      <Text style={textSmall}>
        Payout is processed after the trip is marked as completed.
        For questions about payouts, visit your dashboard.
      </Text>
    </EmailLayout>
  )
}
