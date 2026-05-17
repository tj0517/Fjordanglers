import { Heading, Section, Text, Hr } from '@react-email/components'
import {
  EmailLayout,
  h1,
  text,
  textSmall,
  summaryBox,
  DetailRows,
  hr,
  warnBox,
} from './_shared'

export interface InquiryOfferAnglerEmailProps {
  anglerName: string
  tripTitle: string
  requestedDates: string[]  // YYYY-MM-DD[]
  partySize: number
  offerTotalEur: number     // total trip price (FA's offer)
  offerDepositEur: number   // deposit amount in EUR
  notes: string | null
  inquiryId: string
}

export function InquiryOfferAnglerEmail({
  anglerName,
  tripTitle,
  requestedDates,
  partySize,
  offerTotalEur,
  offerDepositEur,
  notes,
  inquiryId,
}: InquiryOfferAnglerEmailProps) {
  const balanceEur = offerTotalEur - offerDepositEur

  return (
    <EmailLayout preview={`Offer ready — ${tripTitle} — €${offerTotalEur.toFixed(2)}`}>
      <Heading style={h1}>Your trip offer is ready</Heading>

      <Text style={text}>
        Hi {anglerName}, we&apos;ve put together a personalised offer for{' '}
        <strong>{tripTitle}</strong>. Here are all the details:
      </Text>

      {/* Offer breakdown */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={summaryBox}>
        <tbody>
          <DetailRows rows={[
            { label: 'Trip',              value: tripTitle },
            { label: 'Requested dates',   value: fmtDates(requestedDates) },
            { label: 'Party size',        value: `${partySize} ${partySize === 1 ? 'angler' : 'anglers'}` },
            { label: 'Total trip price',  value: `€${offerTotalEur.toFixed(2)}` },
            { label: 'Deposit now',       value: `€${offerDepositEur.toFixed(2)}` },
            { label: 'Balance to guide',  value: `€${balanceEur.toFixed(2)}`, last: true },
          ]} />
        </tbody>
      </table>

      {/* FA notes (if any) */}
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

      {/* Payment info */}
      <Section style={warnBox}>
        <Text style={{ ...textSmall, margin: 0, fontWeight: 600, color: '#92400E' }}>
          💡 &nbsp;The <strong>deposit of €{offerDepositEur.toFixed(2)}</strong> is paid to FjordAnglers
          to secure your booking. The remaining <strong>€{balanceEur.toFixed(2)}</strong> is paid
          directly to the guide on or before the trip date.
        </Text>
      </Section>

      <Text style={text}>
        To proceed, simply reply to this email to confirm your interest. We will then send you
        a secure payment link for the deposit. No payment is required right now.
      </Text>

      <Hr style={hr} />
      <Text style={textSmall}>Reference: {inquiryId}</Text>
      <Text style={textSmall}>
        Questions about this offer? Reply to this email and we&apos;ll get back to you.
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
