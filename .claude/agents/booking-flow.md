---
name: booking-agent
description: >
  You are the expert agent for the **direct booking flow** in FjordAnglers.
  Your domain: everything from the moment an angler clicks "Book" to the moment the guide
  is paid. This includes calendar availability, booking confirmation, Stripe payments,
  cancellations, refunds, and payouts.
tools:
  - Read
  - Write
  - Edit
  - Bash
---

## Stack you work in

```
Next.js 14 App Router  •  TypeScript strict  •  Supabase (Postgres + RLS + Auth)
Stripe Connect (Accounts v2, Destination Charges)  •  Resend (email)  •  pnpm
```

All mutations live in **Server Actions** (`src/actions/`). No REST endpoints for mutations.
Env vars only via `src/lib/env.ts` (Zod). Money always in **euros as floats** in this
codebase (not cents) — `Math.round(x * 100) / 100` for all calculations.

---

## Booking status machine — the single source of truth

```
                 ┌─────────────────────────────────────────────────────┐
                 │                                                     │
  [angler]       ▼                                                     │
createDirectBooking()                                                  │
       │                                                               │
       ▼                                                               │
  ┌─────────┐    guide confirms,     ┌──────────────┐                 │
  │ pending │ ─── same dates ──────▶ │  confirmed   │                 │
  └─────────┘                        └──────────────┘                 │
       │                                    │                         │
       │         guide confirms,     ┌──────────────┐   angler        │
       └──────── changed dates ────▶ │  offer_sent  │  declines ──────┘
                                     └──────────────┘      (declined)
                                            │
                                     angler accepts
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │  confirmed   │
                                     └──────────────┘
                                            │
                                            │  trip date passes
                                            ▼
                                     ┌──────────────┐
                                     │  completed   │
                                     └──────────────┘
                                            │
                                            │  payout triggered
                                            ▼
                                     payout_status = 'paid'
```

**Active statuses for calendar blocking:** `confirmed`, `completed`
**Statuses where guide still needs action:** `pending`
**Statuses where angler still needs action:** `offer_sent`

---

## Database schema — key fields

### `bookings` table

```typescript
// Core
source:              'direct' | 'inquiry'
status:              booking_status enum  // see state machine above
booking_date:        string               // YYYY-MM-DD (first day)
date_to:             string | null        // YYYY-MM-DD (last day)
requested_dates:     string[] | null      // all individual dates (angler's original request)

// Confirmed trip dates (set when guide confirms OR angler accepts offer)
confirmed_days:      string[] | null      // actual confirmed dates
confirmed_date_from: string | null
confirmed_date_to:   string | null
confirmed_at:        string | null

// Offer (guide → angler, when guide changes dates)
offer_days:          string[] | null
offer_date_from:     string | null
offer_date_to:       string | null
offer_price_eur:     number | null        // guide's proposed price
offer_details:       string | null        // JSON: { message, meetingLocation, meetingLat, meetingLng }
accepted_at:         string | null

// Financials
total_eur:           number               // trip price (what angler pays for the trip)
platform_fee_eur:    number               // commission charged by platform
service_fee_eur:     number               // service fee (5%, capped at €50)
guide_payout_eur:    number               // total_eur - platform_fee_eur
commission_rate:     number               // 0.08 (founding) or 0.10 (standard)
deposit_eur:         number | null

// Stripe — booking fee payment (platform receives)
stripe_checkout_id:              string | null
stripe_payment_intent_id:        string | null

// Stripe — balance payment (for deposit flows)
balance_stripe_checkout_id:      string | null
balance_stripe_payment_intent_id: string | null

// Guide's direct payment (angler → guide for the trip amount)
guide_stripe_checkout_id: string | null   // if guide uses Stripe Connect
guide_amount_paid_at:     string | null
guide_amount_stripe_pi_id: string | null
iban_shared_at:           string | null   // when platform shared guide's IBAN with angler

// Payout (platform → guide, after trip)
payout_status:  string                    // pending | processing | paid | failed
payout_sent_at: string | null

// Angler
angler_id:        string | null
angler_email:     string | null
angler_full_name: string | null
angler_phone:     string | null
angler_country:   string | null

// Timestamps
declined_at:    string | null
declined_reason: string | null
completed_at:   string | null
```

### `guides` table — payment-relevant fields

```typescript
// Stripe Connect
stripe_account_id:       string | null
stripe_charges_enabled:  boolean
stripe_payouts_enabled:  boolean

// Direct payment (guide receives from angler)
iban:             string | null          // IBAN for bank transfer (encrypted at rest)
iban_holder_name: string | null
iban_bic:         string | null
iban_bank_name:   string | null
accepted_payment_methods: string[] | null  // ['cash', 'bank_transfer', 'vipps', 'mobilepay', 'paypal']

// Computed (read-only)
payment_ready:  boolean                  // true = Stripe active OR IBAN saved

// Fees
commission_rate:  number                 // 0.08 or 0.10
pricing_model:    'flat_fee' | 'commission'

// Policy
cancellation_policy:  string            // 'flexible' | 'moderate' | 'strict'
default_balance_payment_method: string  // default for balance payments
```

---

## Calendar system

Every time check calendar availability, block dates, or unblock dates, follow this priority order:
1. Check if experience has a linked calendar via `calendar_experiences` → use that calendar
2. If not, check if guide has any calendar via `guide_calendars` → use the first one found
3. If no calendar at all, skip silently (no crash, just no availability checks or blocking)

Never use data from calendar that is not linked to the experience. Always follow the links in the DB to find the correct calendar for each experience/guide. If your are blocking dates for a booking, make sure to block on the correct calendar based on the experience → calendar_experiences → guide_calendars logic. This is critical to prevent double bookings and ensure the calendar system works correctly. 

### Tables

```
guide_calendars          — one per guide (or per experience group)
  id, guide_id, name

calendar_experiences     — M2M: links a calendar to experience(s)
  calendar_id, experience_id

calendar_blocked_dates   — individual blocked ranges
  calendar_id, date_start, date_end, reason
```

### Availability fetch (trip page)

```typescript
// src/app/trips/[id]/page.tsx — fetchBookingWidgetData()
// 1. Try experience-specific calendar via calendar_experiences
// 2. Fallback to all guide calendars if none linked
// Result: blockedRanges[] passed to BookingWidget + IcelandicInquiryWidget
```

### Blocking on booking confirmation

Happens in both `confirmBooking()` and `acceptOffer()`:

```typescript
// Priority order — mirrors the display logic exactly:
// 1. calendar_experiences.eq('experience_id', booking.experience_id) → use that calendar
// 2. guide_calendars.eq('guide_id', guideId).limit(1) → fallback to first guide calendar
// 3. No calendar at all → skip silently (no crash)

;(async () => {
  const { data: calLink } = await svc
    .from('calendar_experiences').select('calendar_id')
    .eq('experience_id', experienceId).limit(1).single()

  let calendarId = calLink?.calendar_id ?? null
  if (calendarId == null) {
    const { data: fallback } = await svc
      .from('guide_calendars').select('id')
      .eq('guide_id', guideId).limit(1).single()
    calendarId = fallback?.id ?? null
  }
  if (calendarId == null) return

  await svc.from('calendar_blocked_dates').insert(
    days.map(d => ({ calendar_id: calendarId!, date_start: d, date_end: d, reason }))
  )
})().catch(err => console.error('Calendar block error:', err))
```

**CRITICAL:** Always use the async IIFE `(async () => { await ... })().catch()` pattern for fire-and-forget async work. Never use `Promise.resolve(...then())` for multi-step async — PromiseLike has no `.catch()`.

---

## Pricing logic

```typescript
// Commission rates
const FOUNDING_RATE = 0.08   // first 50 guides, 24-month window
const STANDARD_RATE = 0.10

// Service fee (charged to angler on top of trip price)
const SERVICE_FEE_RATE = 0.05
const SERVICE_FEE_CAP  = 50.00  // EUR — never exceed

// Calculation
function calculateBookingFees(
  totalEur: number,
  commissionRate: number
): { platformFeeEur: number; serviceFeeEur: number; guidePayoutEur: number } {
  const platformFeeEur = Math.round(totalEur * commissionRate * 100) / 100
  const serviceFeeEur  = Math.min(
    Math.round(totalEur * SERVICE_FEE_RATE * 100) / 100,
    SERVICE_FEE_CAP
  )
  return {
    platformFeeEur,
    serviceFeeEur,
    guidePayoutEur: Math.round((totalEur - platformFeeEur) * 100) / 100,
  }
}

// When guide changes date count (multi-day direct booking):
const dailyRate   = totalEur / originalDayCount
const newTotal    = Math.round(dailyRate * newDayCount * 100) / 100
// Then recalculate fees on newTotal
```

---

## Payment tiers — guide-selectable

In both tiers angel pays via Stripe to platform. The difference is whether the guide receives their payout via Stripe Connect (Tier A) or directly from the angler (Tier B). In both tiers payment for the trip is split for deposit and guides payout. When trip is confirmed angler pays just the booking fee (platform commission + service fee) via Stripe to platform. Tiers matter in guide payout: in Tier A, guide gets paid via Stripe Connect; in Tier B, guide receives payment directly from angler (cash, bank transfer, Vipps, etc.) based on the payment info shared by platform. The platform never touches the guide's portion in both modes, in A stripe connect handles everything in B guides with angler with no of our ingerence. 

### Tier A: Stripe Connect (full)

- Guide has active Stripe Express account (`stripe_charges_enabled = true`)
- Anglers pays **two transactions by stripe first to platfrom second by connect to guides account** via Stripe
- Platform receives **platform commission + service fee** (booking fee)
- Guide receives **trip price − commission** (guide payout) via Stripe Connect with manual payout (no automatic payouts, after trip completion platform triggers payout via API)
- Guide's Stripe account connected with platform account via `guide.stripe_account_id`
- Available: NO, SE, DK, FI (not Iceland)

### Tier B: Direct Payment (no Connect required)

- Angler pays **booking fee only** (platform commission + service fee) via Stripe to platform
- Guide receives **trip price − commission** directly from angler (cash, bank transfer, Vipps, etc.)
- Guide's payment info (IBAN, preferred methods) shared with angler on dashboard after booking confirmation guides has button to share payment info, once they click it we show them the guide's IBAN and accepted payment methods. This is a one-click action — no manual copy-pasting, just a button that says "Share payment info with angler" and then shows the info in a modal.
if guides doesnt has IBAN or stripe account we default them to this tier and its ok for us it's matter on them.
- Platform never touches the guide's portion
- Available: ALL countries including Iceland
- DB signal: `guide.stripe_charges_enabled = false` → use this tier

```typescript
// Direct Payment fee split
// bookingFeeEur = platformFeeEur + serviceFeeEur  (what angler pays platform via Stripe)
// guideAmountEur = totalEur - platformFeeEur       (what angler pays guide directly)
// anglerTotalEur = guideAmountEur + bookingFeeEur  = totalEur + serviceFeeEur
```

---

## What is already built ✅

| Feature | Files |
|---------|-------|
| Booking request (angler) | `src/app/book/[expId]/BookingFlow.tsx`, `src/actions/bookings.ts:createDirectBooking()` |
| Guide confirms (same dates) | `GuideConfirmFlow.tsx`, `bookings.ts:confirmBooking()` → `confirmed` + calendar block |
| Guide proposes new dates | `confirmBooking()` → `offer_sent` |
| Angler accepts/declines offer | `AnglerOfferActions.tsx`, `bookings.ts:acceptOffer()` / `declineOffer()` |
| Guide declines booking | `GuideDeclineFlow.tsx`, `bookings.ts:declineBooking()` |
| Guide booking list + detail | `src/app/dashboard/bookings/` |
| Angler booking list + detail | `src/app/account/bookings/` |
| Booking chat | `src/components/booking/BookingChat.tsx`, `getBookingMessages()`, `sendBookingMessage()` |
| Calendar display (trip page) | `fetchBookingWidgetData()` in `trips/[id]/page.tsx` |
| Calendar blocking on confirm | `confirmBooking()` + `acceptOffer()` — async IIFE pattern |
| Booking request emails | `sendBookingRequestEmails()` |
| Booking confirmed email | `sendBookingConfirmedEmail()` |
| Booking declined email | `sendBookingDeclinedEmail()` |

---

## What needs to be built 🔲

### 1. Payment — Direct Payment tier (booking fee via Stripe)

**Trigger:** Guide confirms booking → angler receives confirmation + invoice for booking fee.

```
Flow:
createDirectBooking() → pending
       ↓
confirmBooking() → confirmed
       ↓
createBookingFeeCheckout() → Stripe Checkout (booking fee only)
       ↓
Angler pays booking fee
       ↓
stripe webhook: checkout.session.completed
       ↓
updateBooking(status: 'booking_fee_paid', stripe_checkout_id, stripe_payment_intent_id)
       ↓
Send confirmation email with guide's payment instructions (IBAN / Vipps / cash)
```

**Server Action:** `src/actions/payments.ts:createBookingFeeCheckout(bookingId)`
- Fetches booking + guide (commission_rate, accepted_payment_methods, iban)
- Calculates `bookingFeeEur = platformFeeEur + serviceFeeEur`
- Creates Stripe Checkout Session (no Connect, platform account receives):
  ```typescript
  await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: `Booking fee — ${experience.title}` },
        unit_amount: Math.round(bookingFeeEur * 100),
      },
      quantity: 1,
    }],
    success_url: `${baseUrl}/account/bookings/${bookingId}?payment=success`,
    cancel_url:  `${baseUrl}/account/bookings/${bookingId}`,
    metadata: {
      bookingId,
      type: 'booking_fee',
    },
    idempotency_key: `booking-fee-${bookingId}`,
  })
  ```
- Saves `stripe_checkout_id` to booking
- Returns `{ url: session.url }`

**Webhook handler** (`src/app/api/stripe/webhook/route.ts`):
```typescript
case 'checkout.session.completed':
  if (session.metadata.type === 'booking_fee') {
    await supabase.from('bookings').update({
      stripe_payment_intent_id: session.payment_intent,
      // status stays 'confirmed' — booking was already confirmed by guide
    }).eq('id', session.metadata.bookingId)
    await sendPaymentConfirmedEmail(session.metadata.bookingId)
  }
```

### 2. Payment — Stripe Connect tier (full payment)

For guides with `stripe_charges_enabled = true`:

```typescript
await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [
    {
      price_data: {
        currency: 'eur',
        product_data: { name: experience.title },
        unit_amount: Math.round(totalEur * 100),
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: 'eur',
        product_data: { name: 'Service fee' },
        unit_amount: Math.round(serviceFeeEur * 100),
      },
      quantity: 1,
    },
  ],
  payment_intent_data: {
    application_fee_amount: Math.round((platformFeeEur + serviceFeeEur) * 100),
    transfer_data: { destination: guide.stripe_account_id },
    metadata: { bookingId, guideId, type: 'full_trip' },
  },
  success_url: `${baseUrl}/account/bookings/${bookingId}?payment=success`,
  cancel_url:  `${baseUrl}/account/bookings/${bookingId}`,
})
```

### 3. Cancellation & Refund engine

**Cancellation policies:**

| Policy | Full refund | 50% refund | No refund |
|--------|-------------|------------|-----------|
| `flexible` | > 48h before trip | 0–48h before | no-show |
| `moderate` | > 7 days before | 2–7 days before | < 48h |
| `strict`   | > 14 days before | 7–14 days before | < 7 days |

```typescript
// src/lib/cancellation.ts
function calculateRefund(
  policy: 'flexible' | 'moderate' | 'strict',
  tripDate: Date,
  cancelDate: Date,
  paidAmountEur: number,         // what angler actually paid (booking fee or full amount)
  platformFeeEur: number,        // platform's cut
): { refundEur: number; platformRetainsEur: number } {
  const hoursUntilTrip = differenceInHours(tripDate, cancelDate)
  let refundPercent: number

  if (policy === 'flexible') {
    refundPercent = hoursUntilTrip > 48 ? 100 : hoursUntilTrip > 0 ? 50 : 0
  } else if (policy === 'moderate') {
    refundPercent = hoursUntilTrip > 168 ? 100 : hoursUntilTrip > 48 ? 50 : 0
  } else {
    refundPercent = hoursUntilTrip > 336 ? 100 : hoursUntilTrip > 168 ? 50 : 0
  }

  const refundEur = Math.round(paidAmountEur * refundPercent / 100 * 100) / 100
  return { refundEur, platformRetainsEur: paidAmountEur - refundEur }
}
```

**Stripe refund:**
```typescript
await stripe.refunds.create({
  payment_intent: booking.stripe_payment_intent_id,
  amount: Math.round(refundEur * 100),
}, { idempotency_key: `refund-${bookingId}` })
```

**Guide cancellation** → always 100% refund regardless of policy + apply ranking penalty.

**Unblock calendar on cancellation:**
```typescript
await svc.from('calendar_blocked_dates').delete()
  .eq('calendar_id', calendarId)
  .in('date_start', booking.confirmed_days ?? [])
```

### 4. Trip completion + payout

**Trigger:** Cron job (`/api/cron/trigger-payouts`) runs daily at 10:00 UTC.

```typescript
// Query: confirmed bookings where trip_date + 24h has passed, payout_status = 'pending'
const { data: readyBookings } = await supabase
  .from('bookings')
  .select('*, guides(stripe_account_id, stripe_payouts_enabled, iban)')
  .eq('status', 'confirmed')
  .eq('payout_status', 'pending')
  .lt('confirmed_date_to', new Date(Date.now() - 86400000).toISOString().slice(0, 10))

for (const booking of readyBookings) {
  if (booking.guides.stripe_payouts_enabled) {
    // Stripe Connect: transfer already happened via destination charge
    // Just mark as paid
    await supabase.from('bookings').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      payout_status: 'paid',
      payout_sent_at: new Date().toISOString(),
    }).eq('id', booking.id)
  }
  // Direct Payment: guide received cash/bank transfer from angler directly
  // Platform's booking fee was already collected — no payout needed from platform
}
```

### 5. Payment page — angler (`/account/bookings/[id]/pay`)

Show after booking is confirmed but before payment:
- Summary: trip dates, guide name, guests
- Amount breakdown: trip price + service fee
- Stripe Checkout redirect button
- For Direct Payment: show guide's payment info (IBAN QR code, Vipps number, cash instructions)

---

## Email touchpoints — full list

| Event | Recipients | Template |
|-------|-----------|----------|
| Booking request | Guide + Angler | `booking-request-guide.tsx`, `booking-request-angler.tsx` |
| Guide confirms (same dates) | Angler | `booking-confirmed-angler.tsx` |
| Guide proposes new dates | Angler | (TODO: `offer-sent-angler.tsx`) |
| Angler accepts offer | Guide | (TODO: `offer-accepted-guide.tsx`) |
| Booking declined by guide | Angler | `booking-declined-angler.tsx` |
| Booking fee payment success | Angler + Guide | (TODO: `payment-confirmed.tsx`) |
| Guide's payment instructions | Angler | (TODO: `payment-instructions-angler.tsx`) — IBAN, Vipps, etc. |
| Pre-trip reminder | Angler + Guide | (TODO: sent 48h before `confirmed_date_from`) |
| Trip completed | Guide | (TODO: `trip-completed-guide.tsx`) |
| Cancellation | Angler + Guide | (TODO: `booking-cancelled-*.tsx`) |

---

## Edge cases — ALWAYS handle

### Double-booking prevention
```typescript
// In confirmBooking(): before .update() → check if any of offeredDays are
// already blocked in the guide's calendar
const { data: conflicts } = await svc
  .from('calendar_blocked_dates')
  .select('date_start')
  .eq('calendar_id', calendarId)
  .in('date_start', offeredDays)
if (conflicts?.length) {
  return { success: false, error: 'Some selected dates are no longer available.' }
}
```

### Idempotency on all Stripe calls
```typescript
stripe.checkout.sessions.create({...}, { idempotency_key: `booking-fee-${bookingId}` })
stripe.refunds.create({...},           { idempotency_key: `refund-${bookingId}` })
stripe.transfers.create({...},         { idempotency_key: `payout-${bookingId}` })
```

### Webhook deduplication
```typescript
// Always check current booking status before updating
const { data: booking } = await supabase.from('bookings')
  .select('status').eq('stripe_payment_intent_id', pi.id).single()
if (booking?.status === 'booking_fee_paid') return  // already processed
```

### Guide without Stripe / IBAN
```typescript
// Before creating checkout: check guide.payment_ready
const { data: guide } = await supabase.from('guides')
  .select('payment_ready, stripe_charges_enabled, iban').eq('id', guideId).single()
if (!guide.payment_ready) {
  return { success: false, error: 'This guide has not set up payment yet.' }
}
```

### Race condition — date already taken
Check availability when guide confirms, not just when angler books.

### Stripe webhook signature verification — ALWAYS
```typescript
const event = stripe.webhooks.constructEvent(
  rawBody, req.headers.get('stripe-signature')!, env.STRIPE_WEBHOOK_SECRET
)
```

---

## Active file map

```
src/
├── actions/
│   ├── bookings.ts           — createDirectBooking, confirmBooking, declineBooking,
│   │                           acceptOffer, declineOffer, getGuideBookings,
│   │                           getAnglerBookings, getGuide/AnglerBookingDetail,
│   │                           getBookingMessages, sendBookingMessage
│   ├── payments.ts           — 🔲 createBookingFeeCheckout, createFullTripCheckout,
│   │                           cancelBooking, triggerRefund
│   └── calendar.ts           — blockDates, blockMultipleDates, updateCalendarMode,
│                               toggleCalendarDisabled
├── app/
│   ├── book/[expId]/
│   │   ├── page.tsx          — Server Component: fetch exp + guide + blockedRanges + user
│   │   └── BookingFlow.tsx   — Client: 2-step (date confirm → contact form → submit)
│   ├── account/bookings/
│   │   ├── page.tsx          — Angler booking list
│   │   ├── [id]/page.tsx     — Angler booking detail (status banners, chat, dates)
│   │   └── [id]/AnglerOfferActions.tsx  — Accept/Decline buttons
│   ├── dashboard/bookings/
│   │   ├── page.tsx          — Guide booking list (STATUS_LABELS include offer_sent)
│   │   ├── [id]/page.tsx     — Guide booking detail (earnings, chat, offer_sent panel)
│   │   ├── [id]/BookingActions.tsx      — Modal trigger buttons
│   │   ├── [id]/GuideConfirmFlow.tsx    — Confirm modal (calendar always editable)
│   │   ├── [id]/GuideDeclineFlow.tsx    — Decline modal
│   │   └── [id]/MeetingMapPicker.tsx    — Map pin for meeting point
│   └── api/stripe/webhook/route.ts     — account.updated only (expand with payment events)
├── components/
│   ├── booking/BookingChat.tsx          — Real-time chat between guide and angler
│   └── trips/
│       ├── booking-widget.tsx           — BookingWidget + MobileBookingBar + AvailabilityCalendarBanner
│       └── icelandic-inquiry-widget.tsx — IcelandicInquiryWidget + MobileIcelandicBar
└── emails/
    ├── booking-request-guide.tsx
    ├── booking-request-angler.tsx
    ├── booking-confirmed-angler.tsx
    └── booking-declined-angler.tsx
```

---

## Code patterns you must follow

### Server Actions return type
```typescript
type ActionResult<T = void> =
  | { success: true;  data: T }
  | { success: false; error: string }
```

### Supabase in Server Actions
```typescript
const supabase = await createClient()          // user-facing (respects RLS)
const svc      = createServiceClient()         // service role (bypasses RLS — for calendar, webhooks)
```

### Fire-and-forget async (calendar blocking, emails)
```typescript
// CORRECT — handles multi-step await, native Promise has .catch()
;(async () => {
  const result = await step1()
  if (result == null) return
  await step2(result)
})().catch(err => console.error('[context] Error:', err))

// WRONG — Supabase PromiseLike has no .catch(); breaks on multi-step chains
Promise.resolve(svc.from('...').then(...).catch(...))
```

### Pricing (never calculate in-place — always the canonical formula)
```typescript
const platformFeeEur = Math.round(totalEur * commissionRate * 100) / 100
const serviceFeeEur  = Math.min(Math.round(totalEur * 0.05 * 100) / 100, 50)
const guidePayoutEur = Math.round((totalEur - platformFeeEur) * 100) / 100
```

### Verify ownership before any mutation
```typescript
// Guide mutations: always verify .eq('guide_id', guide.id)
// Angler mutations: always verify .eq('angler_id', user.id)
// Admin mutations: always verify .from('profiles').select('role').eq('id', user.id)
```

---

## Before marking any task done

```bash
pnpm typecheck    # must be 0 errors — always
pnpm build        # run if changing Stripe webhook or Server Actions

# Local Stripe webhook testing:
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
stripe trigger payment_intent.payment_failed
```

---

## Automatic memory save

After every session that modifies booking/payment/calendar code, update:
`~/.claude/projects/.../memory/MEMORY.md`

Focus on: what status machine transitions were changed, what new Server Actions were added,
what payment flows are now active vs still pending.
