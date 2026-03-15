# FjordAnglers — Agent Orchestra Prompts

Status legend: ✅ Done | 🔄 Pending

---

## WAVE 1 — Foundation (all done, run in parallel)

### ✅ Wave 1A — db-migration-agent: TypeScript types + dashboard actions

> **Already executed.** `src/types/index.ts` has `CancellationPolicy`, `BoatType`, `ExperienceWithGuide`. `src/actions/dashboard.ts` has all new profile fields in `UpdateGuideProfileData` with Zod validation.

---

### ✅ Wave 1B — guide-onboarding-agent: Profile edit form expansion

> **Already executed.** `src/components/dashboard/profile-edit-form.tsx` has new sections: tagline (120 char counter), cancellation policy pills, specialties/certifications multi-select, Google reviews card, boat toggle with full boat fields.

---

### ✅ Wave 1C — booking-flow-agent: Experience form pricing expansion

> **Already executed.** `src/actions/experiences.ts` has `DurationOptionPayload`, `GroupPricingPayload`, `InclusionsPayload` types and all JSONB fields (`duration_options`, `group_pricing`, `inclusions`, `season_from/to`, `fishing_methods`) in both `createExperience` and `updateExperience`. `src/components/experiences/experience-form.tsx` imports and uses all these types.

---

## WAVE 2 — Public-facing pages (run in parallel after Wave 1)

### ✅ Wave 2C — experience-listings-agent: Enrich public guide profile

> **Already executed.** `src/app/(public)/guides/[id]/page.tsx` now renders: tagline (italic, white/70, below guide name in hero), specialties pills (salmon-orange, after bio), Google reviews card (in expertise grid, with G logo + rating + review count + optional link), boat section (⚓ heading + detail chips, after expertise), and cancellation policy snippet (🛡️ icon + label + detail, in sticky sidebar below verified badge). `pnpm typecheck` passes with 0 errors.

**File:** `src/app/(public)/guides/[id]/page.tsx`

**Context:**
The guide profile page already exists and has: cover hero, avatar, fish expertise chips, bio section, expertise/languages cards, stats row, experiences grid (2-col), sticky contact sidebar with social links and verified badge.

**What's missing — add these sections:**

1. **Tagline** — if `guide.tagline != null`, show it as a styled subtitle directly below the guide name in the hero (italic, `text-white/70`, `text-lg`, `f-body`).

2. **Specialties pills** — after the bio section, if `guide.specialties != null && guide.specialties.length > 0`, add a row of salmon-orange pill badges (same style as fish expertise: `background: rgba(230,126,80,0.18)`, `color: '#E67E50'`). Section header: "Specialties".

3. **Google reviews card** — if `guide.google_rating != null`, add a card in the expertise grid with:
   - Google "G" logo (white circle, `#4285F4` bg, 28×28)
   - Rating: `★ X.X` in bold dark blue
   - Review count: `(X reviews)` in muted
   - Link to `guide.google_profile_url` if set (opens new tab)
   - Same card style as existing expertise cards (`background: #FDFAF7`, `borderRadius: 24px`)

4. **Boat section** — if `guide.boat_name != null || guide.boat_type != null`, add a "The boat" section below expertise. Card with:
   - ⚓ icon, boat name as heading
   - Detail chips: `guide.boat_type` (formatted: 'rigid_inflatable' → 'Rigid Inflatable'), length (`Xm`), engine, capacity (`X persons max`)
   - Same card style as expertise cards

5. **Cancellation policy snippet** — in the sticky contact sidebar, below the verified badge. Small info block:
   - Icon + "Flexible / Moderate / Strict cancellation" (map the enum value to a label)
   - Flexible: "Full refund up to 48h before"
   - Moderate: "Full refund up to 7 days before"
   - Strict: "No refund within 14 days"
   - `text-xs`, muted color, no border needed

**Do NOT change:** nav, hero layout, bio section structure, experiences grid, contact sidebar stats, social links section. Only add the items above.

**TypeScript:** `guide` is typed as `GuideRow` from `@/lib/supabase/queries`. The new fields (`tagline`, `specialties`, `google_rating`, `google_profile_url`, `boat_name`, `boat_type`, `boat_length_m`, `boat_engine`, `boat_capacity`, `cancellation_policy`) are already in the DB type — just access them as `guide.tagline` etc. Some may be `null`.

After editing run `pnpm typecheck` and fix any errors before finishing.

---

### ✅ Wave 2D — experience-listings-agent: Listing cards + pagination

> **Already executed.** `src/lib/supabase/queries.ts` now exports `ExperiencesPage = { experiences, total }`, `ExperienceSearchParams` has `page?: string` and `pageSize?: number`, `getExperiences()` uses `{ count: 'exact' }` and `.range()` for server-side pagination (default 12/page). `src/app/experiences/page.tsx` has: inline `<Pagination>` Server Component (smart ellipsis, Fjord Blue active pill, prev/next, preserves all filters in URL); guide avatar 28×28 circle (initial fallback) prepended to guide name; season badge (dark blue, blur) stacked below difficulty badge top-left of photo; count shows total across all pages. `src/app/(public)/species/[slug]/page.tsx` updated to destructure `{ experiences }`. `pnpm typecheck` passes with 0 errors.

**Files:** `src/app/experiences/page.tsx`, `src/lib/supabase/queries.ts`

**Context:**
The `/experiences` page renders all published experiences. Currently: no pagination (all shown), cards have photo + price badge + fish chips + title + guide name. The `getExperiences()` query returns all results.

**Changes needed:**

1. **Pagination — server-side, URL-based**
   - Add `page?: string` to `SearchParams` type in `page.tsx`
   - Add `page` and `pageSize` params to `ExperienceSearchParams` in `queries.ts`
   - In `getExperiences()`, add `.range(offset, offset + pageSize - 1)` (Supabase range pagination). Default `pageSize = 12`.
   - Also return total count: change the query to use `{ count: 'exact' }` and return `{ data, count }`. Create a new return type `ExperiencesPage = { experiences: ExperienceWithGuide[]; total: number }`. Export it. Update `getExperiences()` signature accordingly.
   - In `page.tsx`, read `searchParams.page` (default `'1'`), pass to `getExperiences`. Render page count.
   - Add a `<Pagination />` component inline in `page.tsx` (no separate file): prev/next buttons + page indicator. Uses `<Link>` with updated `?page=N` search params (preserving all other filters). Style: dark blue pill for current page, outlined for others, salmon orange hover. Show only when `total > pageSize`.

2. **Guide avatar on cards**
   - Each experience card already shows guide name. Add the guide avatar: small circle (28×28) before the guide name, using `exp.guide.avatar_url`. If null, show initial letter in `#0A2E4D` bg.
   - Keep existing card layout — just prepend the avatar to the guide name line.

3. **Season badge**
   - If `exp.season_from != null && exp.season_to != null`, add a small season badge on the card photo (top-left corner), e.g. "Jun – Sep". Use short month names. Style: `rgba(10,46,77,0.65)` bg with blur, white text, `text-[10px]`, `rounded-full`, `px-2.5 py-1`.
   - Month mapping: 1=Jan, 2=Feb, … 12=Dec.

**Do NOT change:** filter sidebar, search bar, map view, sort select, mobile filter modal, card hover CTA pill, any other existing card content.

After editing run `pnpm typecheck` and fix any errors before finishing.

---

## WAVE 3 — Booking (after Wave 2)

### ✅ Wave 3E — booking-flow-agent: Booking sidebar on experience detail

> **Already executed.** `src/app/experiences/[id]/page.tsx` imports `BookingWidget` and `MobileBookingBar` from `@/components/experiences/booking-widget`. Both are rendered with availability config, booked dates, and experience data.

---

## Summary of remaining work

| Wave | Agent | Status | Can run with |
|------|-------|--------|-------------|
| 2C | experience-listings-agent | ✅ Done    | —            |
| 2D | experience-listings-agent | ✅ Done    | —            |
| 4A | db-migration-agent        | ✅ Done    | —            |
| 4B | booking-flow-agent        | ✅ Done    | parallel with 4C |
| 4C | booking-flow-agent        | ✅ Done    | parallel with 4B |

All waves complete. Full booking + inquiry flow implemented.

---

## WAVE 4 — Booking Flows (run 4A first, then 4B + 4C in parallel)

### 🔄 Wave 4A — db-migration-agent: Booking DB schema

**Goal:** Add missing columns to `bookings` table and create the `trip_inquiries` table with its enum.

**Context — what already exists:**

The `bookings` table exists with these columns:
```
id, angler_id, experience_id, guide_id, guests, booking_date
status (enum: pending | confirmed | cancelled | completed | refunded)
total_eur, platform_fee_eur, guide_payout_eur
angler_full_name, angler_country, angler_phone, special_requests
created_at, updated_at, confirmed_at, completed_at, cancelled_at, cancelled_reason
```

The `booking_status` enum is missing `accepted` and `declined` values.
The `bookings` table is missing Stripe and deposit columns.
The `trip_inquiries` table does not exist at all.

**Migrations to create (3 separate files, in order):**

**Migration 1 — extend booking_status enum:**
```sql
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'declined';
```

**Migration 2 — add missing columns to bookings:**
```sql
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deposit_eur        numeric(10,2),
  ADD COLUMN IF NOT EXISTS commission_rate    numeric(4,3) DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS stripe_checkout_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS duration_option    text,
  ADD COLUMN IF NOT EXISTS accepted_at        timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at        timestamptz,
  ADD COLUMN IF NOT EXISTS declined_reason    text;
```

**Migration 3 — create trip_inquiries table:**
```sql
CREATE TYPE trip_inquiry_status AS ENUM (
  'inquiry', 'reviewing', 'offer_sent', 'offer_accepted', 'confirmed', 'completed', 'cancelled'
);

CREATE TABLE trip_inquiries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  angler_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  angler_email          text NOT NULL,
  angler_name           text NOT NULL,
  status                trip_inquiry_status NOT NULL DEFAULT 'inquiry',
  dates_from            date NOT NULL,
  dates_to              date NOT NULL,
  target_species        text[] NOT NULL DEFAULT '{}',
  experience_level      text NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'expert')),
  group_size            int NOT NULL CHECK (group_size >= 1),
  preferences           jsonb DEFAULT '{}',
  assigned_guide_id     uuid REFERENCES guides(id) ON DELETE SET NULL,
  assigned_river        text,
  offer_price_eur       numeric(10,2),
  offer_details         text,
  stripe_checkout_id    text,
  stripe_payment_intent_id text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE trip_inquiries ENABLE ROW LEVEL SECURITY;

-- Angler can read their own inquiries
CREATE POLICY "angler_read_own_inquiries"
  ON trip_inquiries FOR SELECT
  USING (angler_id = auth.uid() OR angler_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Anyone authenticated can insert
CREATE POLICY "insert_inquiry"
  ON trip_inquiries FOR INSERT
  WITH CHECK (true);

-- Only service role can update (admin panel uses service role)
CREATE POLICY "service_role_update_inquiries"
  ON trip_inquiries FOR UPDATE
  USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER set_trip_inquiries_updated_at
  BEFORE UPDATE ON trip_inquiries
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- Index for admin queue sorting
CREATE INDEX idx_trip_inquiries_status_created ON trip_inquiries(status, created_at DESC);
```

After creating all 3 migrations, run `pnpm supabase db push` to apply them, then `pnpm supabase gen types typescript --local > src/lib/supabase/database.types.ts` to regenerate types.

---

### ✅ Wave 4B — booking-flow-agent: Classic Booking — Checkout + Webhook + Angler History

> **Already executed.** Full booking flow: `src/actions/bookings.ts` (`createBookingCheckout`, `acceptBooking`, `declineBooking`), `/book/[expId]/page.tsx` (2-col checkout with price breakdown + 30% deposit), `/book/[expId]/confirmation/page.tsx`, `/api/stripe/webhook/route.ts` (handles `checkout.session.completed` + `charge.refunded`), `/account/bookings/page.tsx` (angler history), `/dashboard/bookings/page.tsx` updated with accept/decline buttons (`BookingActions` client component). `pnpm typecheck` + `pnpm build` pass with 0 errors.

---

> Depends on: Wave 4A completed.

**Context — what already exists:**

- `BookingWidget` at `src/components/experiences/booking-widget.tsx` — full calendar + group size + price calc. CTA button links to `/book/${expId}?dates=YYYY-MM-DD,...` (already works).
- `/dashboard/bookings` at `src/app/dashboard/bookings/page.tsx` — guide sees all bookings in a table. Has stats row (total, pending, confirmed, earned). No accept/decline actions yet.
- `bookings` table fully set up (after Wave 4A). Stripe + deposit columns added.
- `booking_status` enum: `pending | accepted | declined | confirmed | cancelled | completed | refunded`

**What to build:**

#### 1. Server Action: `createBookingCheckout` (`src/actions/bookings.ts`, new file)

```typescript
'use server'

export async function createBookingCheckout(input: {
  experienceId: string
  dates: string[]         // ISO date strings from widget
  guests: number
  durationOptionLabel?: string
  anglerName: string
  anglerEmail: string
  anglerPhone?: string
  anglerCountry?: string
  specialRequests?: string
}): Promise<{ checkoutUrl: string } | { error: string }>
```

Logic:
- Look up experience (title, price, guide_id, duration_options, max_guests)
- Look up guide (stripe_account_id, commission_rate from guides.pricing_model)
- Validate guests ≤ max_guests, dates not empty
- Calculate: `total_eur = price × guests × dates.length`, `platform_fee_eur = total × 0.10` (or 0.08 if founding guide), `guide_payout_eur = total - platform_fee`, `deposit_eur = total × 0.30`
- Insert `bookings` row with `status: 'pending'`, all calculated fields, `stripe_checkout_id = null` (will update via webhook)
- Create Stripe Checkout session: `payment_method_types: ['card']`, `line_items` with experience title + dates summary, `amount = deposit_eur * 100` (cents), `currency: 'eur'`, `metadata: { bookingId }`, `success_url: /book/${bookingId}/confirmation`, `cancel_url: /experiences/${experienceId}`
- Update booking row with `stripe_checkout_id = session.id`
- Return `{ checkoutUrl: session.url }`

Use `@/lib/stripe/server` for Stripe client (create the file if it doesn't exist: `import Stripe from 'stripe'; export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)`).

#### 2. Checkout page: `/book/[expId]/page.tsx` (new)

This is a Server Component. URL: `/book/[expId]?dates=2026-06-01,2026-06-02&guests=2`

- Read searchParams: `dates` (comma-separated ISO strings), `guests` (number, default 1)
- If dates empty → redirect back to `/experiences/${expId}`
- Fetch experience (title, price, guide, duration_options, images[0])
- Render a clean 2-column layout:
  - **Left:** experience summary card (title, guide name, selected dates as chips, guest count, price breakdown: subtotal + 7% service fee + **30% deposit now + 70% later**)
  - **Right:** angler contact form (`anglerName`, `anglerEmail`, `anglerPhone`, `anglerCountry` select, `specialRequests` textarea, submit button "Request to Book")
- Form submission calls `createBookingCheckout` via Server Action → redirect to Stripe Checkout URL
- Auth check: if user is logged in, pre-fill anglerName + anglerEmail from their profile
- Style: same brand tokens (#0A2E4D, #E67E50, #FDFAF7, rounded-2xl, f-body/f-display)

#### 3. Confirmation page: `/book/[expId]/confirmation/page.tsx` (new)

- Show success message: "Your request has been sent to [guide name]"
- Show booking summary: dates, guests, total, deposit paid
- Trust signals: "Guide will confirm within 24h. No further charge until confirmed."
- Link back to `/experiences` and `/account/bookings`

#### 4. Stripe Webhook: `/api/stripe/webhook/route.ts` (new)

```typescript
export async function POST(req: Request) { ... }
```

Handle these events:
- `checkout.session.completed` → find booking by `session.metadata.bookingId`, set `status: 'confirmed'`, `confirmed_at: now()`, `stripe_payment_intent_id: session.payment_intent` — then send email to guide (use Resend or just `console.log` as placeholder)
- `charge.refunded` → find booking by payment_intent, set `status: 'refunded'`
- Verify Stripe webhook signature using `stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)`

#### 5. Accept/decline actions on guide dashboard

Add to `src/actions/bookings.ts`:

```typescript
export async function acceptBooking(bookingId: string): Promise<{ error?: string }>
export async function declineBooking(bookingId: string, reason?: string): Promise<{ error?: string }>
```

- `acceptBooking`: verify caller is the guide for this booking, set `status: 'accepted'`, `accepted_at: now()`
- `declineBooking`: verify caller is guide, set `status: 'declined'`, `declined_at: now()`, `declined_reason`

In `src/app/dashboard/bookings/page.tsx`, for rows where `booking.status === 'pending'`, add two buttons after the status badge:
- "Accept" → calls `acceptBooking(booking.id)` via Server Action form
- "Decline" → calls `declineBooking(booking.id)` via Server Action form
- Style: Accept = small green pill button, Decline = small red ghost button. Use `<form action={...}>` pattern.

Also update `STATUS_STYLES` to include `accepted` (green) and `declined` (red).

#### 6. Angler booking history: `/account/bookings/page.tsx` (new)

Server Component. Auth guard: redirect to `/login` if not authenticated.

Fetch bookings where `angler_id = user.id`, joined with `experiences(title, images)` and `guides(full_name, avatar_url)`.

Render a list of booking cards showing:
- Experience title + first image thumbnail
- Guide name + avatar
- Dates, guests, total paid
- Status badge (same STATUS_STYLES pattern)
- Link to `/experiences/${experience.id}` to rebook

Empty state: "No bookings yet — browse experiences →"

**TypeScript:** run `pnpm typecheck` after all changes and fix all errors.

---

### ✅ Wave 4C — booking-flow-agent: Icelandic Flow — Inquiry Form + Admin Queue + Offer

> **Already executed.** `src/actions/inquiries.ts` (`submitInquiry`, `updateInquiryStatus`, `sendOffer`, `acceptOffer`), `/plan-your-trip/page.tsx` (2-step client form), `/admin/inquiries/page.tsx` (queue with stats), `/admin/inquiries/[id]/page.tsx` (detail + offer form via `AdminInquiryActions`), `/account/trips/[id]/page.tsx` (status timeline + offer card + `AcceptOfferButton`). Admin sidebar updated with Inquiries link. `pnpm typecheck` + `pnpm build` pass with 0 errors.

> Depends on: Wave 4A completed. Can run in parallel with Wave 4B.

**Context — what already exists:**

- `trip_inquiries` table created in Wave 4A with status enum: `inquiry | reviewing | offer_sent | offer_accepted | confirmed | completed | cancelled`
- Admin panel exists at `/admin` — layout at `src/app/admin/layout.tsx`, other admin pages follow the same card/table style as `src/app/admin/guides/page.tsx`

**What to build:**

#### 1. Server Action: `submitInquiry` (`src/actions/inquiries.ts`, new file)

```typescript
'use server'

export async function submitInquiry(formData: {
  anglerName: string
  anglerEmail: string
  datesFrom: string     // ISO date
  datesTo: string       // ISO date
  targetSpecies: string[]
  experienceLevel: 'beginner' | 'intermediate' | 'expert'
  groupSize: number
  preferences: {
    budgetMin?: number
    budgetMax?: number
    accommodation?: boolean
    riverType?: string
    notes?: string
  }
}): Promise<{ inquiryId: string } | { error: string }>
```

Logic:
- Validate with Zod (all required fields)
- If user is authenticated, also set `angler_id = user.id`
- Insert `trip_inquiries` row with `status: 'inquiry'`
- Return `{ inquiryId }`
- Email notifications: placeholder `console.log` for now (real Resend integration later)

#### 2. Inquiry form page: `/plan-your-trip/page.tsx` (new)

Two-step form layout (step 1 = dates + basics, step 2 = preferences + submit). Use `"use client"` for multi-step state.

**Step 1 — Your Trip:**
- Date range: "Dates From" + "Dates To" (date inputs)
- Target species: multi-select pill buttons: Salmon, Trout, Pike, Perch, Zander, Arctic Char, Sea Trout, Grayling, Halibut, Cod
- Group size: number stepper (1–12)
- Experience level: pill selector (Beginner / Intermediate / Expert)

**Step 2 — Preferences:**
- Budget range: "Min €" + "Max €" inputs (optional)
- Accommodation needed: Yes / No / Flexible toggle
- River type preference: River / Lake / Sea / Any
- Notes / special requests: textarea
- Name + Email (if not logged in, pre-fill from session if logged in)
- Submit button: "Send My Request →"

On submit: call `submitInquiry` Server Action → show thank-you state: "We've received your request. Expect a reply within 48 hours." with link back to `/experiences`.

**Page hero:** Short headline "Plan Your Custom Fishing Trip" with subtext "Tell us what you're looking for — we'll match you with the perfect guide and river." Style: same brand tokens.

#### 3. Admin inquiries queue: `/admin/inquiries/page.tsx` (new)

Server Component. Follow exact same layout/style as `src/app/admin/guides/page.tsx`.

Fetch all `trip_inquiries`, ordered by `created_at DESC`.

Stats row: total inquiries, pending (inquiry + reviewing), offer_sent count, confirmed count.

Table columns: Angler | Dates | Species | Group | Level | Status | Submitted

Status badge styles:
- `inquiry`: orange (same as pending)
- `reviewing`: blue `rgba(59,130,246,0.1)` / `#3B82F6`
- `offer_sent`: purple `rgba(139,92,246,0.1)` / `#7C3AED`
- `offer_accepted`: green
- `confirmed`: green
- `completed`: green
- `cancelled`: red

Each row: click → links to `/admin/inquiries/[id]`

#### 4. Admin inquiry detail: `/admin/inquiries/[id]/page.tsx` (new)

Server Component. Fetch full `trip_inquiries` row by id.

Two-panel layout:
- **Left panel:** Full inquiry details — angler name/email, dates, target species, group size, experience level, all preferences, submitted timestamp
- **Right panel:** Admin action area with status-dependent content:
  - If `status === 'inquiry'`: button "Mark as Reviewing" → calls `updateInquiryStatus(id, 'reviewing')`
  - If `status === 'reviewing'`: form to send offer:
    - Assign guide (select from verified guides list)
    - Assigned river/location (text input)
    - Offer price EUR (number input)
    - Offer details (rich textarea — what's included, meeting point, notes)
    - Button "Send Offer →" → calls `sendOffer(id, { assignedGuideId, assignedRiver, offerPriceEur, offerDetails })`
  - If `status === 'offer_sent'`: show offer summary (read-only), note "Awaiting angler response"
  - If `status === 'offer_accepted'`: show "Payment link sent" or button to create Stripe Checkout
  - If `status === 'confirmed'` / `'completed'`: show trip summary

Add to `src/actions/inquiries.ts`:
```typescript
export async function updateInquiryStatus(inquiryId: string, status: 'reviewing'): Promise<{ error?: string }>
export async function sendOffer(inquiryId: string, offer: {
  assignedGuideId: string
  assignedRiver: string
  offerPriceEur: number
  offerDetails: string
}): Promise<{ error?: string }>
```

#### 5. Angler offer view: `/account/trips/[id]/page.tsx` (new)

Server Component. Auth guard.

Fetch `trip_inquiries` row where `id = params.id` and `angler_id = user.id OR angler_email = user.email`.

Show:
- Inquiry summary (dates, species, group)
- Current status timeline (horizontal stepper: Inquiry → Reviewing → Offer → Confirmed)
- If `status === 'offer_sent'`: show offer card (guide name, river, price, offer details) with "Accept Offer →" button
- "Accept Offer" calls `acceptOffer(inquiryId)` Server Action → creates Stripe Checkout → redirect to Stripe

Add to `src/actions/inquiries.ts`:
```typescript
export async function acceptOffer(inquiryId: string): Promise<{ checkoutUrl: string } | { error: string }>
```

Logic: verify angler owns inquiry, set `status: 'offer_accepted'`, create Stripe Checkout for `offer_price_eur`, return checkout URL.

Handle `checkout.session.completed` for inquiries in the existing webhook (`/api/stripe/webhook/route.ts`): detect if `session.metadata.inquiryId` is set, update `status: 'confirmed'`.

**TypeScript:** run `pnpm typecheck` after all changes and fix all errors.
