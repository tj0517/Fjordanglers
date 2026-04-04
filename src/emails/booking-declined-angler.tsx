import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  noteBox, warnBox,
} from './_shared'

export interface BookingDeclinedAnglerEmailProps {
  anglerName:        string
  experienceTitle:   string
  guideName:         string
  declinedReason:    string | null
  alternativeDates:  string | null  // pre-formatted, e.g. "12 May – 18 May 2026"
  didRefund:         boolean
  searchUrl:         string
}

export function BookingDeclinedAnglerEmail({
  anglerName, experienceTitle, guideName, declinedReason,
  alternativeDates, didRefund, searchUrl,
}: BookingDeclinedAnglerEmailProps) {
  return (
    <EmailLayout preview={`Your booking request for ${experienceTitle} was declined.`}>
      <Heading style={h1}>Booking request declined</Heading>

      <Text style={text}>Hi {anglerName},</Text>

      <Text style={text}>
        Unfortunately <strong>{guideName}</strong> is unable to take your booking for{' '}
        <strong>{experienceTitle}</strong> at this time.
      </Text>

      {declinedReason && (
        <Section style={warnBox}>
          <Text style={{ color: '#92400E', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 4px' }}>
            Reason
          </Text>
          <Text style={{ color: '#78350F', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
            {declinedReason}
          </Text>
        </Section>
      )}

      {alternativeDates && (
        <Section style={noteBox}>
          <Text style={{ color: '#1D4ED8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 4px' }}>
            Alternative dates suggested
          </Text>
          <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
            {guideName} is available on: <strong>{alternativeDates}</strong>.
            You can send a new booking request for those dates directly.
          </Text>
        </Section>
      )}

      {didRefund && (
        <Section style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '14px 18px', margin: '0 0 24px' }}>
          <Text style={{ color: '#16A34A', fontSize: '14px', fontWeight: 600, margin: 0 }}>
            ✓ Your payment has been refunded in full
          </Text>
        </Section>
      )}

      <Text style={text}>
        Don't let this stop you — there are many great fishing guides waiting for you.
      </Text>

      <Section style={ctaSection}>
        <Button style={button} href={searchUrl}>Browse other guides</Button>
      </Section>

      <Text style={textSmall}>
        If you believe this was a mistake, reply to this email and we'll look into it.
      </Text>
    </EmailLayout>
  )
}
