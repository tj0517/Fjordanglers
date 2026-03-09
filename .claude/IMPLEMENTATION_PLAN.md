# FjordAnglers — Implementation Plan
_Priority: guides have something public to show ASAP_

---

## PHASE 0 — Foundation (DB + Infra) [Day 1]
_Everything else depends on this. Do first, in one session._

### 0.1 Supabase Schema Migration
Single migration file covering all tables:

**Tables:**
```
profiles          — extends auth.users (role: 'guide' | 'angler' | 'admin')
guides            — guide profile (bio, location, languages, status, stripe_account_id, pricing_model)
experiences       — fishing trips offered by a guide (title, description, price, duration, max_guests, fish_types, location)
experience_images — photos for experiences
bookings          — booking record (experience_id, angler_id, guide_id, date, status, price_paid, commission)
payments          — Stripe payment record (booking_id, stripe_payment_intent_id, amount, currency, status)
leads             — guide outreach tracking (for Tymon/Łukasz)
```

**RLS Policies:**
- `profiles`: read public, write own row
- `guides`: read all (public listing), update own
- `experiences`: read all if guide.status='active', CRUD own
- `bookings`: guide sees own, angler sees own, admin sees all
- `payments`: guide + angler see own, admin sees all
- `leads`: admin only

**Enums:**
- `guide_status`: `pending | verified | active | suspended`
- `pricing_model`: `flat_fee | commission`
- `booking_status`: `pending | confirmed | cancelled | completed | refunded`
- `payment_status`: `pending | paid | failed | refunded`

### 0.2 Generate TypeScript Types
```
supabase gen types typescript --project-id ... > src/lib/supabase/database.types.ts
```

### 0.3 Supabase Helpers (`src/lib/supabase/`)
- `client.ts` — browser client (singleton)
- `server.ts` — server client with cookies (for Server Components/Actions)
- `middleware.ts` — session refresh middleware
- `index.ts` — re-exports

### 0.4 Env Validation (`src/lib/env.ts`)
Zod schema validating all env vars at build time.

### 0.5 Stripe Helpers (`src/lib/stripe/`)
- `client.ts` — Stripe server instance
- `connect.ts` — Connect account helpers (create, get onboarding link)
- `webhooks.ts` — signature verification + event routing

---

## PHASE 1 — Public Pages (Guides Have Something to Show) [Day 2-3]
_Goal: a live URL guides can send to friends/clients right now_

### 1.1 UI Component Library (`src/components/ui/`)
Build once, use everywhere:
- `Button` — variants: primary (Fjord Blue), secondary, ghost
- `Card` — with optional image header
- `Badge` — for fish types, languages, status
- `Avatar` — guide photo with fallback initials
- `Skeleton` — loading states
- `Container` — max-width wrapper

### 1.2 Home Page `/` (revamp `src/app/page.tsx`)
**Sections:**
1. Hero — "Epic Fjord Fishing Experiences" + CTA buttons (Browse Experiences / Become a Guide)
2. Featured Experiences — 6 cards pulled from DB (experiences with status=active)
3. How It Works — 3-step explainer for anglers
4. Featured Guides — 3 guide cards
5. Footer — nav links, social, tagline

### 1.3 Experiences Listing `/experiences`
**Route:** `src/app/(marketing)/experiences/page.tsx`

- Server Component, SSR
- Filters (sidebar): country, fish type, price range, duration, difficulty
- URL search params for filter state
- Experience cards: photo, title, guide name+avatar, price, duration, location, fish types
- Pagination (12 per page)
- Empty state with CTA

### 1.4 Experience Detail `/experiences/[id]`
**Route:** `src/app/(marketing)/experiences/[id]/page.tsx`

- Photo gallery (main + thumbnails)
- Title, description, highlights
- Guide mini-profile card with link to guide page
- Key info: duration, max guests, difficulty, fish types, what's included/excluded
- Price + "Book Now" button (disabled if guide not active — shows "Coming Soon")
- Location map placeholder
- SEO metadata (og:image, description from DB)

### 1.5 Guide Public Profile `/guides/[id]`
**Route:** `src/app/(marketing)/guides/[id]/page.tsx`

- Hero: cover photo, avatar, name, location, languages
- Bio / About section
- Stats: years experience, trips led, species caught
- Their active experiences (cards grid)
- Social links (Instagram, etc.)
- "Contact Guide" button (link to booking or email)
- SEO metadata

### 1.6 Guides Directory `/guides`
**Route:** `src/app/(marketing)/guides/page.tsx`

- Grid of guide cards
- Filter by: country, language, fish type
- Card: photo, name, location, languages, # of experiences, rating (placeholder)

### 1.7 Shared Layout Components
- `Navbar` — logo, Browse Experiences, Become a Guide, Login/Sign Up
- `Footer`
- `src/app/(marketing)/layout.tsx` — wraps all public pages

---

## PHASE 2 — Auth System [Day 3-4]
_Needed for everything that requires login_

### 2.1 Middleware (`middleware.ts` at root)
- Supabase session refresh on every request
- Protect `/dashboard/*` and `/onboarding/*` routes
- Redirect unauthenticated users to `/login`

### 2.2 Auth Pages
- `/login` — email/password + magic link option
- `/register` — choose role (Angler / Guide), then email+password
- `/auth/callback` — handles Supabase OAuth/magic link redirect
- `/auth/confirm` — email confirmation landing

### 2.3 Server Actions (`src/actions/auth.ts`)
- `signIn(email, password)`
- `signUp(email, password, role)`
- `signOut()`
- `sendMagicLink(email)`

### 2.4 Auth Context/Helpers
- `src/lib/supabase/auth.ts` — `getSession()`, `getUser()`, `requireAuth()`

---

## PHASE 3 — Guide Onboarding Flow [Day 4-5]
_So Krzychu can onboard guides and they appear on the site_

### 3.1 Onboarding Wizard `/onboarding/guide`
Multi-step form (4 steps), state in URL params or React state:

**Step 1 — Personal Info:**
- Full name, profile photo upload (Supabase Storage)
- Location (country, city)
- Languages spoken (multi-select)
- Years of experience

**Step 2 — Bio & Specialties:**
- Short bio (textarea, 500 chars)
- Fish species expertise (multi-select: Salmon, Trout, Pike, Sea Bass, Cod…)
- Certifications (free text)
- Social links (Instagram, YouTube)

**Step 3 — Pricing Model:**
- Choose: Flat fee €29/month OR Commission (10%, no monthly fee)
- Show comparison table with pros/cons

**Step 4 — Stripe Connect:**
- "Connect your bank account to receive payouts"
- Button → redirect to Stripe Express onboarding
- On return: show pending verification status

### 3.2 Server Actions (`src/actions/guides.ts`)
- `createGuideProfile(data)` — creates `guides` row, sets status=`pending`
- `updateGuideProfile(data)` — update own profile
- `createStripeConnectAccount()` — create Stripe Express account, store ID
- `getStripeOnboardingLink()` — generate onboarding URL

### 3.3 Stripe Connect Integration
- Flow: create Express account → onboarding link → webhook confirms `account.updated`
- `src/lib/stripe/connect.ts`:
  - `createExpressAccount(email, country)`
  - `createAccountLink(accountId, returnUrl, refreshUrl)`
  - `getAccount(accountId)`
  - `isAccountReady(account)` — checks charges_enabled + payouts_enabled

### 3.4 Return Pages
- `/onboarding/guide/stripe-return` — success, show "Account connected, pending review"
- `/onboarding/guide/stripe-refresh` — re-generate link if expired

---

## PHASE 4 — Guide Dashboard [Day 5-6]
_Guides need a place to manage their listings_

### 4.1 Dashboard Layout
- `src/app/(platform)/dashboard/layout.tsx`
- Sidebar nav: Overview, My Experiences, Bookings, Payouts, Settings
- Mobile: bottom tab bar

### 4.2 Overview `/dashboard`
- Welcome message + verification status badge
- Stats: upcoming bookings, total earnings this month, pending payments
- Quick actions: Add Experience, View Profile, Withdraw (if applicable)
- Recent bookings table (last 5)

### 4.3 My Experiences `/dashboard/experiences`
- List of guide's experiences (draft + published)
- Status badge: draft, active, paused
- Actions: Edit, Pause, Delete
- "+ Add Experience" button

### 4.4 Add/Edit Experience `/dashboard/experiences/new` & `/dashboard/experiences/[id]/edit`
**Form fields:**
- Title, description (rich text minimal)
- Fish types (multi-select)
- Duration (hours or days)
- Max guests
- Price per person (EUR)
- Difficulty level (beginner/intermediate/expert)
- What's included / excluded (bullet lists)
- Meeting point / location
- Images (up to 8, drag-to-reorder, Supabase Storage)
- Status toggle (draft / active)

### 4.5 Bookings `/dashboard/bookings`
- Tabs: Upcoming, Pending, Past, Cancelled
- Booking card: angler name, experience, date, guests, amount
- Actions: Confirm, Cancel (with reason), Message (Phase 6)

### 4.6 Payouts `/dashboard/payouts`
- Stripe dashboard embed or summary
- Balance: available, pending
- Payout history table
- "Go to Stripe Dashboard" link

### 4.7 Settings `/dashboard/settings`
- Edit profile (bio, photos, languages, social)
- Pricing model switch (with confirmation dialog)
- Subscription status (if flat fee)
- Notification preferences
- Danger zone: deactivate account

---

## PHASE 5 — Booking Flow [Day 6-7]
_The core marketplace transaction_

### 5.1 Booking Form (on Experience Detail page)
**Sticky sidebar component `BookingWidget`:**
- Date picker (calendar with guide's availability — Phase 7)
- Number of guests (1 to max_guests)
- Price breakdown: per person × guests = subtotal, platform fee (if commission), total
- "Request to Book" button

### 5.2 Booking Confirmation Page `/bookings/[id]/confirm`
- Summary: experience, guide, date, guests, total
- Angler details form: full name, phone, country, special requests
- Terms checkbox
- "Proceed to Payment" → Stripe Checkout

### 5.3 Stripe Checkout
- Create `PaymentIntent` with application_fee_amount (commission model) or direct charge (flat fee)
- Transfer to guide's `stripe_account_id` via Stripe Connect
- `return_url` → `/bookings/[id]/success`

### 5.4 Server Actions (`src/actions/bookings.ts`)
- `createBooking(experienceId, date, guests)` — creates booking, returns ID
- `createPaymentIntent(bookingId)` — creates Stripe PI, returns client_secret
- `cancelBooking(bookingId, reason)` — updates status, triggers refund if applicable
- `confirmBooking(bookingId)` — guide confirms (changes status)

### 5.5 Booking Success Page `/bookings/[id]/success`
- Confirmation number
- Summary of what was booked
- "What happens next" instructions
- Links to angler dashboard

### 5.6 Angler Dashboard `/dashboard/angler`
- My Bookings: upcoming, past, cancelled
- Booking detail with guide contact info (post-confirmation)
- Profile settings

---

## PHASE 6 — Webhooks & Payment Automation [Day 7-8]

### 6.1 Stripe Webhook Handler `src/app/api/webhooks/stripe/route.ts`
Events to handle:
- `payment_intent.succeeded` → mark payment paid, confirm booking, trigger email
- `payment_intent.payment_failed` → mark booking failed, notify angler
- `account.updated` → update guide's Stripe status in DB (set active when ready)
- `account.deauthorized` → suspend guide, notify
- `transfer.created` → log payout record
- `customer.subscription.deleted` → downgrade flat-fee guide

### 6.2 Commission Calculation Logic
`src/lib/stripe/pricing.ts`:
- `calculateFee(amount, pricingModel)`:
  - commission: `amount * 0.10` → `application_fee_amount`
  - flat_fee: `0` application fee (guide pays €29/month separately)
- `createPaymentIntentParams(booking)` — returns full PI params

---

## PHASE 7 — Admin Panel & Verification [Day 8-9]
_For Krzychu to verify guides_

### 7.1 Admin Route `/admin`
Protected by `role='admin'` check in middleware.

### 7.2 Guide Verification Queue `/admin/guides`
- List of guides with status=`pending`
- Guide card: photo, name, bio, Stripe status, registration date
- Actions:
  - **Verify** → set status=`verified`, send welcome email
  - **Activate** → set status=`active` (guide appears publicly)
  - **Reject** → set status=`suspended`, add rejection note
- Filter by status: pending / verified / active / suspended

### 7.3 Admin Actions (`src/actions/admin.ts`)
- `verifyGuide(guideId)` — status → verified
- `activateGuide(guideId)` — status → active (appears on site)
- `suspendGuide(guideId, reason)` — status → suspended

### 7.4 Booking Overview `/admin/bookings`
- All bookings across the platform
- Filter by date, guide, status
- Manual overrides (cancel, refund)

---

## PHASE 8 — Email Notifications [Day 9-10]
_Using Supabase Auth emails + custom via Resend/SendGrid_

### 8.1 Transactional Emails
Set up Resend (or SendGrid) via Supabase Edge Function or API route:

| Trigger | Recipient | Subject |
|---------|-----------|---------|
| Guide registers | Guide | "Welcome to FjordAnglers — your application is under review" |
| Guide verified | Guide | "You're verified! Complete your Stripe setup" |
| Guide activated | Guide | "You're live! Your profile is now public" |
| New booking | Guide | "New booking request from [angler]" |
| Booking confirmed | Angler | "Booking confirmed! See you on [date]" |
| Booking cancelled | Both | "Booking cancelled — [reason]" |
| Payment received | Guide | "You received a payment of €[amount]" |

### 8.2 Email Templates
Simple HTML templates in `src/lib/email/templates/`:
- Use consistent brand colors (Fjord Blue #1B4F72, Salmon Orange #E67E22)

---

## PHASE 9 — SEO & Performance [Day 10]

### 9.1 Metadata
- Dynamic `generateMetadata()` for all public pages
- `og:image` per experience/guide using Next.js OG image generation
- `sitemap.ts` — auto-generated from experiences + guides
- `robots.ts`

### 9.2 Performance
- Images: use `next/image` with Supabase Storage CDN
- ISR (Incremental Static Regeneration) for experience/guide detail pages
- `loading.tsx` Suspense boundaries for slow DB queries

---

## PHASE 10 — Lead Management for Outreach [Parallel with any phase]
_For Tymon and Łukasz's Instagram outreach_

### 10.1 Leads Table (in Phase 0 migration)
Fields: instagram_handle, name, country, fish_types, status (new/contacted/responded/onboarded/rejected), notes, contacted_at, responded_at

### 10.2 Simple Leads View `/admin/leads`
- Table with filters
- Add/edit lead record
- Status pipeline view (Kanban-lite)
- Export to CSV

---

## DELIVERY ORDER (by priority)

```
Day 1  → Phase 0   (DB schema, helpers, env)
Day 2  → Phase 1   (Home, Experiences list, Experience detail, Guide profile)
         ↑ GUIDES CAN SHARE THEIR PROFILE URL
Day 3  → Phase 1   (finish public pages) + Phase 2 (Auth)
Day 4  → Phase 3   (Guide onboarding + Stripe Connect)
Day 5  → Phase 4   (Guide dashboard + experience CRUD)
         ↑ GUIDES CAN ADD/MANAGE EXPERIENCES
Day 6  → Phase 5   (Booking flow + Stripe Checkout)
Day 7  → Phase 6   (Webhooks + payment automation)
Day 8  → Phase 7   (Admin verification panel for Krzychu)
Day 9  → Phase 8   (Email notifications)
Day 10 → Phase 9   (SEO + Performance)
         Phase 10  (Leads management — run parallel anytime)
```

---

## KEY ARCHITECTURAL DECISIONS

| Decision | Choice | Reason |
|----------|--------|--------|
| Mutations | Server Actions (not API routes) | Per CLAUDE.md, simpler, type-safe |
| Images | Supabase Storage → `next/image` | Already in stack, CDN built-in |
| Auth | Supabase Auth + `@supabase/ssr` | Already in deps |
| Email | Resend (add as dep) | Best DX, simple API |
| Rich text | Minimal textarea initially | Avoid complexity, upgrade later |
| Availability | Phase 7 (skip initially) | Use free-text "contact to book" first |
| i18n | Polish UI for now, English content | Anglers see EN, add PL later |

---

## FILES TO CREATE (complete list)

```
supabase/migrations/
  001_initial_schema.sql

src/lib/env.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/database.types.ts (generated)
src/lib/stripe/client.ts
src/lib/stripe/connect.ts
src/lib/stripe/pricing.ts
src/lib/stripe/webhooks.ts
src/lib/email/index.ts
src/lib/email/templates/*.ts

src/types/index.ts  (domain types built on DB types)

src/components/ui/button.tsx
src/components/ui/card.tsx
src/components/ui/badge.tsx
src/components/ui/avatar.tsx
src/components/ui/skeleton.tsx
src/components/ui/container.tsx
src/components/shared/navbar.tsx
src/components/shared/footer.tsx
src/components/guides/guide-card.tsx
src/components/guides/guide-profile-header.tsx
src/components/experiences/experience-card.tsx
src/components/experiences/experience-gallery.tsx
src/components/experiences/booking-widget.tsx
src/components/bookings/booking-card.tsx

src/actions/auth.ts
src/actions/guides.ts
src/actions/experiences.ts
src/actions/bookings.ts
src/actions/admin.ts

src/app/(marketing)/layout.tsx
src/app/(marketing)/page.tsx  (replace root)
src/app/(marketing)/experiences/page.tsx
src/app/(marketing)/experiences/[id]/page.tsx
src/app/(marketing)/guides/page.tsx
src/app/(marketing)/guides/[id]/page.tsx

src/app/(platform)/dashboard/layout.tsx
src/app/(platform)/dashboard/page.tsx
src/app/(platform)/dashboard/experiences/page.tsx
src/app/(platform)/dashboard/experiences/new/page.tsx
src/app/(platform)/dashboard/experiences/[id]/edit/page.tsx
src/app/(platform)/dashboard/bookings/page.tsx
src/app/(platform)/dashboard/payouts/page.tsx
src/app/(platform)/dashboard/settings/page.tsx
src/app/(platform)/dashboard/angler/page.tsx

src/app/(auth)/login/page.tsx
src/app/(auth)/register/page.tsx
src/app/(auth)/callback/route.ts

src/app/onboarding/guide/page.tsx  (wizard)
src/app/onboarding/guide/stripe-return/page.tsx
src/app/onboarding/guide/stripe-refresh/page.tsx

src/app/bookings/[id]/confirm/page.tsx
src/app/bookings/[id]/success/page.tsx

src/app/admin/layout.tsx
src/app/admin/guides/page.tsx
src/app/admin/bookings/page.tsx
src/app/admin/leads/page.tsx

src/app/api/webhooks/stripe/route.ts

middleware.ts  (root)
```

---

## SUPABASE STORAGE BUCKETS
- `guide-avatars` — public, guide profile photos
- `guide-covers` — public, guide cover photos
- `experience-images` — public, experience photos
- `private-docs` — private, any sensitive documents

---

## SEED DATA (for dev/demo)
Create 3 demo guides with experiences so the site looks populated immediately:
- `supabase/seed.sql` — insert 3 guides, 2 experiences each, with placeholder images
