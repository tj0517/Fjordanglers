# FjordAnglers — Booking Flow

> Status: **ready to implement**
> Commission model: 10% standard, 8% for Founding Guides (year 1)
> Payment model: Option A — Full Platform Pay (Stripe Connect, 30% deposit + 70% balance)

---

## Implementation Plan

### Workflow 1 — Classic Booking (Standard Guides)

**What to build:**

- [ ] `bookings` table in Supabase (schema below)
- [ ] Booking widget on `/experiences/[id]` — date picker, participant count, price preview
- [ ] Auth gate — redirect to login/register if unauthenticated before payment
- [ ] Stripe Checkout session — 30% deposit, `metadata: { experienceId, guidId, participants, tripDate }`
- [ ] Webhook handler at `/api/stripe/webhook`:
  - `checkout.session.completed` → insert booking row with `status: confirmed`, notify guide by email
  - `payment_intent.payment_failed` → show error, keep status
  - `charge.refunded` → set `status: refunded`, notify both parties
- [ ] Guide dashboard `/dashboard/bookings` — list of incoming bookings with accept/decline actions
- [ ] Server Action: `acceptBooking(bookingId)` → set `status: accepted`, send angler the balance payment link
- [ ] Server Action: `declineBooking(bookingId)` → set `status: declined`, refund deposit via Stripe, notify angler
- [ ] Balance payment page `/book/[bookingId]/balance` — remaining 70% collected before trip date
- [ ] Angler booking history `/account/bookings`
- [ ] Email notifications (Resend): new request → guide, accepted → angler, declined → angler, confirmed → both

**Stripe Connect flow:**
```
platform_fee = total * 0.10          // or 0.08 for Founding Guide
guide_payout = total - platform_fee

PaymentIntent with application_fee_amount + transfer_data.destination = guide.stripe_account_id
Payout released after status → completed
```

---

### Workflow 2 — Icelandic Flow (Concierge / Custom Trips)

**What to build:**

- [ ] `trip_inquiries` table in Supabase (schema below)
- [ ] Inquiry form page `/plan-your-trip` — dates, target species, experience level, group size, budget range, preferences textarea
- [ ] Server Action: `submitInquiry(formData)` → insert `trip_inquiries` row with `status: inquiry`, send confirmation email to angler, alert email to FjordAnglers team
- [ ] Admin queue `/admin/inquiries` — list all inquiries, sortable by status
- [ ] Admin inquiry detail page `/admin/inquiries/[id]` — view full form data, assign guide, set offer price, write offer details, send offer
- [ ] Server Action: `sendOffer(inquiryId, { assignedGuideId, offerPriceEur, offerDetails })` → set `status: offer_sent`, email personalised offer to angler
- [ ] Angler offer view `/account/trips/[id]` — show offer details, accept button
- [ ] Server Action: `acceptOffer(inquiryId)` → set `status: offer_accepted`, create Stripe Checkout for full or deposit amount
- [ ] Webhook: `checkout.session.completed` → set `status: confirmed`, notify both parties
- [ ] Email notifications: inquiry received → angler + team, offer sent → angler, offer accepted → both, trip confirmed → both

---

## Two Booking Models

### 1. Classic Booking (Standard Guides)

Angler books directly → Guide accepts/rejects → Payment collected.

```
/experiences/[id]
  └── Select date + number of participants
  └── Click "Request booking"
      └── Auth check (login/register if needed)
      └── Stripe Checkout — 30% deposit
          └── checkout.session.completed webhook
              └── booking row created, status: confirmed
              └── Guide receives notification → accepts or declines
                  └── Accepted → angler receives balance payment link
                  └── Declined → deposit refunded, angler notified
```

---

### 2. Icelandic Flow (Concierge / Custom Trips)

Used for complex, curated trips (e.g. Iceland). FjordAnglers acts as the middleman — matches angler to the right river, outfitter, and handles licenses.

```
/plan-your-trip
  └── Angler fills in request form:
      - Dates
      - Target species
      - Experience level (beginner / intermediate / expert)
      - Group size
      - Preferences (river type, accommodation, budget range)
  └── Request submitted → FjordAnglers team reviews at /admin/inquiries
      └── Team matches: guide + river + license logistics
      └── Personalised offer sent back to angler (email + /account/trips/[id])
          └── Angler accepts offer
              └── Stripe Checkout (full or deposit TBD)
              └── Trip confirmed

```

**Key difference:** No instant booking. FjordAnglers team manually matches the inquiry.

---

## Booking States

### Classic Booking

| Status | Description |
|---|---|
| `pending` | Request sent, waiting for guide to respond |
| `accepted` | Guide accepted, awaiting balance payment |
| `confirmed` | Deposit received, trip confirmed |
| `completed` | Trip took place, payout released |
| `declined` | Guide declined, deposit refunded |
| `cancelled` | Cancelled by angler or guide after confirmation |
| `refunded` | Full refund issued |

### Icelandic Flow

| Status | Description |
|---|---|
| `inquiry` | Angler submitted request form |
| `reviewing` | FjordAnglers team is processing |
| `offer_sent` | Personalised offer sent to angler |
| `offer_accepted` | Angler accepted, awaiting payment |
| `confirmed` | Payment received, trip confirmed |
| `completed` | Trip took place |
| `cancelled` | Cancelled at any stage |

---

## Payment Flow (Stripe Connect)

```
// Deposit (30%) at booking time
depositAmount = total * 0.30
platform_fee   = total * commission_rate   // 0.10 or 0.08 (Founding Guide year 1)
guide_payout   = total - platform_fee

// Balance (70%) due before trip date
balanceAmount = total * 0.70
```

- All payouts via **Stripe Connect Express** (`guides.stripe_account_id`)
- Payout timing: after status → `completed`
- Founding Guide commission: 8% for first 12 months, then 10%

---

## Webhook Events (`/api/stripe/webhook`)

| Event | Action |
|---|---|
| `checkout.session.completed` | Set booking `confirmed`, notify guide |
| `payment_intent.payment_failed` | Keep status, show error to angler |
| `charge.refunded` | Set booking `refunded`, notify both parties |

---

## Routes

```
/experiences/[id]                      Classic booking — experience detail + booking widget
/book/[bookingId]/balance              Balance payment page (70% remainder)
/book/[bookingId]/confirmation         Success page
/plan-your-trip                        Icelandic flow — inquiry form
/account/bookings                      Angler booking history (both flows)
/account/trips/[id]                    Single trip detail + offer view
/dashboard/bookings                    Guide booking management
/admin/inquiries                       FjordAnglers team — Icelandic flow request queue
/admin/inquiries/[id]                  Inquiry detail + assign guide + send offer
/api/stripe/webhook                    Stripe webhook handler
```

---

## Database Tables

```sql
bookings                               -- Classic flow
  id                uuid         PK default gen_random_uuid()
  experience_id     uuid         FK → experiences.id
  angler_id         uuid         FK → auth.users.id
  guide_id          uuid         FK → guides.id
  status            text         'pending' | 'accepted' | 'confirmed' | 'completed' | 'declined' | 'cancelled' | 'refunded'
  total_eur         numeric
  deposit_eur       numeric      -- 30% of total
  platform_fee_eur  numeric
  guide_payout_eur  numeric
  commission_rate   numeric      -- 0.10 or 0.08
  stripe_checkout_id          text
  stripe_payment_intent_id    text
  stripe_transfer_id          text
  trip_date         date
  participants      int
  created_at        timestamptz  default now()
  updated_at        timestamptz  default now()

trip_inquiries                         -- Icelandic flow
  id                uuid         PK default gen_random_uuid()
  angler_id         uuid         FK → auth.users.id (nullable — allow unauthenticated)
  angler_email      text         -- captured from form if not logged in
  status            text         'inquiry' | 'reviewing' | 'offer_sent' | 'offer_accepted' | 'confirmed' | 'completed' | 'cancelled'
  dates_from        date
  dates_to          date
  target_species    text[]
  experience_level  text         'beginner' | 'intermediate' | 'expert'
  group_size        int
  preferences       jsonb        -- budget_range, accommodation, river_type, notes
  assigned_guide_id uuid         FK → guides.id (nullable)
  assigned_river    text
  offer_price_eur   numeric
  offer_details     text
  stripe_checkout_id          text
  stripe_payment_intent_id    text
  created_at        timestamptz  default now()
  updated_at        timestamptz  default now()
```

---

## Email Notifications

### Classic Flow

| Trigger | Recipient | Content |
|---|---|---|
| Booking requested | Guide | New booking request + date + participants |
| Booking accepted | Angler | Guide accepted — balance payment link |
| Booking declined | Angler | Decline notice + deposit refund confirmation |
| Payment confirmed | Both | Trip confirmation details |
| Trip completed | Guide | Payout notification |

### Icelandic Flow

| Trigger | Recipient | Content |
|---|---|---|
| Inquiry submitted | Angler | "We received your request — expect a reply within 48h" |
| Inquiry submitted | FjordAnglers team | New inquiry alert with full form data |
| Offer sent | Angler | Personalised offer + price + accept link |
| Offer accepted + paid | Both | Trip confirmed |

---

## Open Questions (TBD)

- Icelandic flow: full payment upfront vs. 15/85 split? To be decided
- Refund policy: platform fee refundable on cancellations? If guy canceled on us, we should keep the fee. If we cancel on him, we should refund the fee.
- Balance payment timing: how many days before trip? To be decided
- Founding Guide eligibility: auto-detected from `guides.is_founding_guide` field? YEs
