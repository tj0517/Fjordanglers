import { Heading, Section, Text, Hr, Link, Button } from '@react-email/components'
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
  warnBox,
} from './_shared'

export interface InquiryRichOfferAnglerEmailProps {
  anglerName: string
  tripTitle: string
  guideName: string
  requestedDates: string[]
  partySize: number
  offerTotalEur: number
  offerDepositEur: number
  notes: string | null
  offerUrl: string
  inquiryId: string
}

export function InquiryRichOfferAnglerEmail({
  anglerName,
  tripTitle,
  guideName,
  requestedDates,
  partySize,
  offerTotalEur,
  offerDepositEur,
  notes,
  offerUrl,
  inquiryId,
}: InquiryRichOfferAnglerEmailProps) {
  const balanceEur = offerTotalEur - offerDepositEur

  return (
    <EmailLayout preview={`Your personalised offer — ${tripTitle} — €${offerTotalEur.toFixed(2)}`}>
      <Heading style={h1}>Your personalised offer is ready</Heading>

      <Text style={text}>
        Hi {anglerName}, we&apos;ve put together a personalised offer for{' '}
        <strong>{tripTitle}</strong> with <strong>{guideName}</strong>.
        Your offer includes the full trip plan, what&apos;s included,
        licence information, and everything you need to know before you confirm.
      </Text>

      {/* Offer summary */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={summaryBox}>
        <tbody>
          <DetailRows rows={[
            { label: 'Trip',             value: tripTitle },
            { label: 'Guide',            value: guideName },
            { label: 'Requested dates',  value: fmtDates(requestedDates) },
            { label: 'Party size',       value: `${partySize} ${partySize === 1 ? 'angler' : 'anglers'}` },
            { label: 'Total trip price', value: `€${offerTotalEur.toFixed(2)}` },
            { label: 'Deposit to secure', value: `€${offerDepositEur.toFixed(2)}` },
            { label: 'Balance to guide', value: `€${balanceEur.toFixed(2)}`, last: true },
          ]} />
        </tbody>
      </table>

      {/* FA notes */}
      {notes != null && notes.trim() !== '' && (
        <Section style={noteFromFa}>
          <Text style={{ ...textSmall, margin: '0 0 4px', fontWeight: 700, color: '#0A2E4D' }}>
            Note from FjordAnglers:
          </Text>
          <Text style={{ ...text, margin: 0, fontStyle: 'italic' }}>
            &ldquo;{notes}&rdquo;
          </Text>
        </Section>
      )}

      {/* Deposit info */}
      <Section style={warnBox}>
        <Text style={{ ...textSmall, margin: 0, fontWeight: 600, color: '#92400E' }}>
          💡 &nbsp;The <strong>deposit of €{offerDepositEur.toFixed(2)}</strong> is paid to
          FjordAnglers to secure your booking. The remaining{' '}
          <strong>€{balanceEur.toFixed(2)}</strong> is paid directly to the guide on or before
          the trip date.
        </Text>
      </Section>

      {/* CTA */}
      <Section style={ctaSection}>
        <Button href={offerUrl} style={button}>
          View Full Offer &amp; Secure Your Spot →
        </Button>
      </Section>

      <Text style={{ ...textSmall, textAlign: 'center', color: '#6B7280' }}>
        Your offer includes the full trip itinerary, what&apos;s included, licence requirements,
        and a secure deposit payment option.
      </Text>

      <Hr style={hr} />

      <Text style={textSmall}>
        If you have questions, simply reply to this email.{' '}
        Offer reference: {inquiryId}
      </Text>

      <Text style={{ ...textSmall, margin: 0 }}>
        Offer link:{' '}
        <Link href={offerUrl} style={{ color: '#E67E50' }}>{offerUrl}</Link>
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

const noteFromFa: React.CSSProperties = {
  backgroundColor: '#F0F7FF',
  border: '1px solid #DBEAFE',
  borderLeft: '3px solid #0A2E4D',
  borderRadius: '4px',
  padding: '16px 20px',
  margin: '0 0 24px',
}
