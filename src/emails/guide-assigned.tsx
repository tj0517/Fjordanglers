import { Heading, Section, Text, Hr, Button } from '@react-email/components'
import {
  EmailLayout,
  h1,
  text,
  textSmall,
  summaryBox,
  DetailRows,
  hr,
  button,
  ctaSection,
} from './_shared'

export interface GuideAssignedEmailProps {
  guideName: string
  anglerName: string
  experienceTitle: string
  requestedDates: string[]
  partySize: number
  tripsUrl: string
}

export function GuideAssignedEmail({
  guideName,
  anglerName,
  experienceTitle,
  requestedDates,
  partySize,
  tripsUrl,
}: GuideAssignedEmailProps) {
  return (
    <EmailLayout preview={`New trip assigned: ${anglerName} — ${experienceTitle}`}>
      <Heading style={h1}>New trip assigned to you</Heading>

      <Text style={text}>
        Hi {guideName}, Tymon has assigned you to handle a new enquiry.
        An angler named <strong>{anglerName}</strong> is interested in{' '}
        <strong>{experienceTitle}</strong>.
      </Text>

      {/* Summary */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={summaryBox}>
        <tbody>
          <DetailRows rows={[
            { label: 'Angler',         value: anglerName },
            { label: 'Experience',     value: experienceTitle },
            { label: 'Requested dates', value: fmtDates(requestedDates) },
            { label: 'Party size',     value: `${partySize} ${partySize === 1 ? 'angler' : 'anglers'}`, last: true },
          ]} />
        </tbody>
      </table>

      <Text style={text}>
        You can view the full enquiry details in your guide dashboard.
        FjordAnglers will handle all communication with the angler —
        this is just so you know what&apos;s coming.
      </Text>

      {/* CTA */}
      <Section style={ctaSection}>
        <Button href={tripsUrl} style={button}>
          View Trip →
        </Button>
      </Section>

      <Hr style={hr} />

      <Text style={textSmall}>
        Questions? Reply to this email or contact Tymon directly.
      </Text>
    </EmailLayout>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDates(dates: string[]): string {
  if (dates.length === 0) return 'To be confirmed'
  return dates.map(fmtDate).join(', ')
}
