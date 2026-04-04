import { Button, Heading, Section, Text } from '@react-email/components'
import {
  EmailLayout, h1, text, textSmall, button, ctaSection,
  summaryBox, labelCell, valueCell, summaryRow, summaryRowLast, noteBox,
} from './_shared'

export interface InquiryReceivedGuideEmailProps {
  guideName:        string
  anglerName:       string
  anglerEmail:      string
  anglerCountry:    string | null
  datesLabel:       string
  species:          string[]
  guests:           number
  experienceLevel:  string    // 'beginner' | 'intermediate' | 'expert'
  budget:           string | null   // pre-formatted, e.g. "€500–€1000"
  notes:            string | null
  inquiryUrl:       string    // /dashboard/bookings/[id]
}

const levelLabel: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  expert:       'Expert',
}

export function InquiryReceivedGuideEmail({
  guideName, anglerName, anglerEmail, anglerCountry,
  datesLabel, species, guests, experienceLevel, budget, notes, inquiryUrl,
}: InquiryReceivedGuideEmailProps) {
  return (
    <EmailLayout preview={`${anglerName} sent you a fishing request.`}>
      <Heading style={h1}>New fishing request</Heading>

      <Text style={text}>Hi {guideName},</Text>

      <Text style={text}>
        <strong>{anglerName}</strong>
        {anglerCountry ? ` from ${anglerCountry}` : ''}{' '}
        is looking for a guide and sent you a request. Review the details and
        send them an offer from your dashboard.
      </Text>

      {/* Angler brief */}
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
              <td style={labelCell}>Availability</td>
              <td style={valueCell}>{datesLabel}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Target species</td>
              <td style={valueCell}>{species.join(', ')}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Group size</td>
              <td style={valueCell}>{guests} {guests === 1 ? 'angler' : 'anglers'}</td>
            </tr>
            <tr style={summaryRow}>
              <td style={labelCell}>Experience level</td>
              <td style={valueCell}>{levelLabel[experienceLevel] ?? experienceLevel}</td>
            </tr>
            {budget && (
              <tr style={summaryRow}>
                <td style={labelCell}>Budget</td>
                <td style={valueCell}>{budget}</td>
              </tr>
            )}
            {!budget && <tr style={summaryRowLast}><td colSpan={2} /></tr>}
            {budget && <tr style={summaryRowLast}><td colSpan={2} /></tr>}
          </tbody>
        </table>
      </Section>

      {notes && (
        <Section style={noteBox}>
          <Text style={{ color: '#1D4ED8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 4px' }}>
            Angler&apos;s notes
          </Text>
          <Text style={{ color: '#374151', fontSize: '14px', lineHeight: '22px', margin: 0 }}>
            {notes}
          </Text>
        </Section>
      )}

      <Section style={ctaSection}>
        <Button style={button} href={inquiryUrl}>Review &amp; send offer</Button>
      </Section>

      <Text style={textSmall}>
        Respond within 24 hours to maximise your booking conversion.
        You can ask questions or send an offer directly from the dashboard.
      </Text>
    </EmailLayout>
  )
}
