import { formatDepositAmount } from '@/lib/inquiries/deposit'
import type { OfferForPanel } from './NextStepCard'

interface Props {
  offer:              OfferForPanel | null
  depositAmountCents: number | null
  depositCurrency:    string | null
  depositPaidAt:      string | null
}

function DealRow({ label, value, muted = false, positive = false }: { label: string; value: string; muted?: boolean; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm f-body">
      <span className="text-muted-foreground">{label}</span>
      <span className={positive ? 'font-semibold text-emerald-700' : muted ? 'font-semibold text-muted-foreground' : 'font-semibold text-foreground'}>
        {value}
      </span>
    </div>
  )
}

/** "Deal" numbers — display only, no actions (FA-1.32). */
export function DealCard({ offer, depositAmountCents, depositCurrency, depositPaidAt }: Props) {
  const acceptedIdx    = offer?.options.findIndex(o => o.is_accepted) ?? -1
  const acceptedOption = acceptedIdx >= 0 ? offer!.options[acceptedIdx] : null
  const isAccepted     = offer?.status === 'accepted'
  const amountSet      = depositAmountCents != null && depositCurrency != null

  let offerValue = '—'
  let offerMuted = true
  if (offer != null) {
    offerMuted = false
    switch (offer.status) {
      case 'draft':     offerValue = 'Draft'; break
      case 'presented': offerValue = 'Presented'; break
      case 'accepted':  offerValue = acceptedIdx >= 0 ? `Accepted · option ${acceptedIdx + 1}` : 'Accepted'; break
      case 'declined':  offerValue = 'Declined'; break
      default:          offerValue = offer.status
    }
  }

  let priceValue = '—'
  let priceMuted = true
  if (acceptedOption != null) {
    priceValue = formatDepositAmount(acceptedOption.price_cents, acceptedOption.currency)
    priceMuted = false
  } else if (offer != null && offer.options.length === 1) {
    priceValue = formatDepositAmount(offer.options[0].price_cents, offer.options[0].currency)
    priceMuted = false
  } else if (offer != null && offer.options.length > 1) {
    priceValue = `${offer.options.length} options`
    priceMuted = false
  }

  const depositLabel = isAccepted || depositPaidAt != null ? 'Deposit to FA' : 'Deposit'
  let depositValue = '—'
  let depositMuted = true
  let depositPaid  = false
  if (amountSet) {
    depositValue = formatDepositAmount(depositAmountCents, depositCurrency)
    depositMuted = false
    if (depositPaidAt != null) { depositValue += ' · paid'; depositPaid = true }
  } else if (isAccepted) {
    depositValue = 'not set'
  } else if (offer != null && (offer.status === 'draft' || offer.status === 'presented')) {
    depositValue = 'after acceptance'
  }

  // Balance to guide = trip price − deposit; display only, same currency required.
  const balance = isAccepted && acceptedOption != null && depositAmountCents != null && depositCurrency != null
    && acceptedOption.currency.toUpperCase() === depositCurrency.toUpperCase()
    ? { cents: acceptedOption.price_cents - depositAmountCents, currency: depositCurrency }
    : null

  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-5 flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">Deal</p>
      <DealRow label="Offer"      value={offerValue}   muted={offerMuted} />
      <DealRow label="Trip price" value={priceValue}   muted={priceMuted} />
      <DealRow label={depositLabel} value={depositValue} muted={depositMuted} positive={depositPaid} />
      {balance != null && (
        <DealRow label="Balance to guide" value={formatDepositAmount(balance.cents, balance.currency)} />
      )}
    </section>
  )
}
