# FjordAnglers — Payments Spec

> What the payment system should manage, and how money flows between anglers, guides, and the platform.
> No implementation details — pure flow and responsibility.

---

## Participants

| Role | Responsibility |
|------|---------------|
| **Angler** | Pays for the trip (deposit + balance) |
| **Guide** | Receives payout after trip completion |
| **Platform (FjordAnglers)** | Collects commission + service fee, manages payouts via Stripe Connect |

---

## Money Split (per booking)

```
Angler pays:
  subtotal         = price_per_person × guests × trip_days
  service_fee      = subtotal × 5%           ← platform revenue
  total            = subtotal + service_fee

Platform takes:
  commission       = subtotal × 10%  (standard)
                   = subtotal × 8%   (Founding Guide — first 24 months)
  platform_revenue = service_fee + commission

Guide receives:
  payout           = subtotal − commission
```

The balance (70%) carries no commission — 100% goes to the guide.

---

## Payment Timing

| Stage | What is paid | Who triggers it |
|-------|-------------|-----------------|
| Booking confirmed by angler | 30% deposit | Angler (Stripe Checkout) |
| Before/after the trip | 70% balance | Angler (Stripe) or guide (cash) |

---

## Flow A — Direct Booking

For experiences with `booking_type = 'direct'`. Angler books instantly; guide accepts.

```
1. Angler submits booking request
      → booking created (no payment yet)

2. Guide reviews and accepts, sets exact dates
      → Stripe Checkout created for 30% deposit
      → angler receives payment link

3. Angler pays deposit
      → booking confirmed
      → guide's payout portion transferred immediately via Stripe Connect

4a. Angler pays 70% balance online
      → trip completed
      → no additional platform fee on balance

4b. Guide collects 70% balance in cash
      → guide marks as paid manually
      → trip completed
```

**Guide can decline at any stage:**
- Before payment → no financial action
- After payment → full refund to angler, transfer reversed on guide's account

---

## Flow B — Icelandic Inquiry

For experiences with `booking_type = 'icelandic'`. No instant booking — guide proposes custom offer.

```
1. Angler submits inquiry with dates, species, group size, budget
      → inquiry created (no payment)

2. Guide reviews, optionally requests more info

3. Guide sends custom offer
      → price, dates, meeting point, trip details
      → angler notified

4. Angler accepts the offer
      → Stripe Checkout created for full offer price (100%)
      → no deposit/balance split — single charge

5. Angler pays
      → inquiry confirmed
      → booking record created automatically
      → guide's payout transferred via Stripe Connect

6. Trip completed
```

**Guide can decline** at any stage before payment — inquiry cancelled, no financial action.

---

## Guide Payout Account

The guide must connect a bank account before receiving payouts. This is managed via **Stripe Express Connect**:

- Guide goes through Stripe's hosted onboarding (identity, bank account)
- Stripe verifies the account asynchronously
- Once approved → `payouts_enabled = true` → guide can receive transfers
- Payouts land in guide's bank account **every Monday** (weekly schedule)

Guides in countries not supported by Stripe (e.g. Iceland) cannot use Stripe payouts — manual arrangement required.

---

## Refunds & Cancellations

| Booking state | Refund behaviour |
|---------------|-----------------|
| Pending (no payment) | No action — booking deleted/declined |
| Accepted (checkout created, not paid) | Checkout expired — no refund needed |
| Confirmed (deposit paid) | Full refund to angler, guide's transfer reversed |
| Completed | Manual admin action only |

Cancellation windows (free refund):
- **Flexible** — up to 7 days before trip
- **Moderate** — up to 14 days before trip
- **Strict** — up to 30 days before trip

Weather Guarantee — admin-triggered full refund at any time.

---

## Webhook Events to Handle

These are events the platform must listen for from Stripe:

| Event | What it means | Action required |
|-------|--------------|-----------------|
| `checkout.session.completed` | Angler successfully paid | Confirm booking or inquiry |
| `charge.refunded` | A charge was refunded | Mark booking/inquiry as refunded/cancelled |
| `account.updated` | Guide's Stripe account verification changed | Update guide's payout status in DB |

`checkout.session.completed` and `charge.refunded` → **regular platform webhook**
`account.updated` → **Connect webhook** (separate endpoint registration in Stripe Dashboard)

---

## What the Platform Does NOT Do

- Does not store card details
- Does not hold funds — Stripe handles escrow and splits
- Does not manage VAT (guides are responsible for their own tax)
- Does not issue invoices to anglers (Stripe receipts only)

---

## Future: PayPal

If PayPal is added as an alternative payment method, it should cover:

- **Checkout** — PayPal as a payment option alongside Stripe (deposit + balance)
- **Payouts** — PayPal Payouts API for guides who prefer it over bank transfer
- **Refunds** — PayPal refund API triggered by the same cancellation logic
- **Webhooks** — `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`

The platform logic (pricing, commission, status machine) stays the same — PayPal is just a different payment rail under the same flow.
