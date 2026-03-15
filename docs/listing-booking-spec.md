# FjordAnglers — Listing, Booking & Policies Spec

> Version: 3.0 · Date: 2026-03-13
> Author: Tymon + Claude
> Status: Draft — ready for team review
> Based on: Competitive analysis of 9 platforms + team decisions on payment model, pricing, architecture

---

## Architecture: Three Page Types

FjordAnglers has **three distinct page types** — unlike FishingBooker and most competitors who put everything on one guide profile.

| Page | URL | Purpose |
|---|---|---|
| **Guide Profile** | `/guides/[country]/[slug]` | Who is this person? Bio, experience, photo, languages, specialties, list of their trips |
| **Trip Page** | `/trips/[slug]` | What's the trip? Duration, price, species, inclusions, meeting point, booking form |
| **Plan Your Trip** | `/plan-your-trip` | Concierge flow for complex/custom trips (Iceland, multi-river packages) |

**Why split?**

1. **SEO** — A trip page targeting "half day salmon fishing tromsø" ranks better than a bloated guide profile. Each trip becomes its own keyword-targeted landing page.
2. **One guide, many trips** — Erik offers salmon in summer and ice fishing in winter. These are different products with different audiences. They deserve separate pages.
3. **Clarity** — The guide profile answers "Should I trust this person?" The trip page answers "Is this the right trip for me?" Separate questions, separate pages.
4. **Search results** — Anglers search for trips, not guides. Search results show trip cards. The guide is context on that card, not the star.

---

## Design Principles

1. **"Your trip, your rules"** — Guides control their pricing, packages, and cancellation terms. We never force standardization.
2. **Simplicity** — An angler should go from "I want to fish in Norway" to "booked" in under 5 minutes.
3. **Advertising platform, not travel agency** — The contract is always between angler and guide. We facilitate, never sell.
4. **Friend, not corporate** — Every piece of copy sounds like a fishing buddy, not a booking engine.

---

## PART 1: GUIDE PROFILE PAGE

### What it is

One URL per guide: `/guides/[country]/[slug]`
Example: `/guides/norway/erik-hansen-tromso`

This page answers one question: **"Who is this guide and can I trust them?"**

It does NOT contain booking forms, trip details, or pricing. Those live on trip pages.

---

### 1.1 Profile Header

| Field | Required | Source | Notes |
|---|---|---|---|
| Guide name | ✅ | Admin onboarding | Full name, e.g., "Erik Hansen" |
| Profile photo | ✅ | Guide provides | Minimum 400×400px, cropped to circle |
| Tagline | ✅ | Guide provides | 1 sentence, max 120 chars. E.g., "Salmon & trout specialist in Northern Norway since 2008" |
| Location | ✅ | Admin sets | Country + region. E.g., "Tromsø, Norway" |
| Languages spoken | ✅ | Checklist | EN / NO / SE / FI / DE / PL — badges on profile |
| Years of experience | ✅ | Guide provides | Number, displayed as "12 years guiding" |
| Verified badge | Auto | Krzychu verification | "Verified by FjordAnglers" — shown when guide passes Krzychu's check |
| Rating + review count | Auto | System | "4.8 ★ (23 reviews)" — from platform reviews + external sources |

**Tone example:**
❌ "Professional fishing guide offering exclusive experiences"
✅ "Erik has been guiding anglers on the Målselv river for 12 years. He knows every pool."

---

### 1.2 Guide Photo Gallery

| Spec | Details |
|---|---|
| Minimum photos | 3 (enforced at onboarding) |
| Maximum photos | 10 (guide-level; trips have their own photos) |
| Format | WebP (auto-converted from JPG/PNG on upload) |
| Sizes | Thumbnail: 400×300, Full: 1200×900, Hero: 1600×1000 |
| Storage | Supabase Storage, CDN via Vercel |
| Display | Carousel on mobile, grid on desktop. First photo = hero |

These photos are about the **guide** — portrait shots, action shots, the boat, happy clients. Trip-specific catches and scenery go on the trip page.

---

### 1.3 Guide Bio

| Field | Type | Notes |
|---|---|---|
| About (long bio) | Rich text, max 1000 chars | Written in third person by admin during onboarding. Tells the guide's story. |
| Specialties | Tags | E.g., "Fly fishing expert", "Family-friendly", "Trophy salmon" |
| Certifications | List | E.g., "Licensed Norwegian Fishing Guide", "First Aid Certified" |

**Bio tone guide:**
❌ "Erik is a world-class professional with extensive expertise..."
✅ "Erik grew up fishing the Målselv. He started guiding in 2008 after friends kept asking him to take them to his spots. His specialty is finding big salmon in the upper pools — the ones most anglers walk past."

---

### 1.4 Boat Details (Conditional)

Only shown if the guide has boat-based trips. Hidden for pure river/shore guides.

| Field | Type | Notes |
|---|---|---|
| Boat name | Text | E.g., "Nordkapp 660" |
| Boat type | Select | Center console / Cabin / RIB / Drift boat / Kayak |
| Length | Decimal (m) | E.g., 6.6m |
| Engine | Text | E.g., "Mercury 150HP" |
| Max capacity | Number | E.g., 6 anglers |
| Boat photo | Image | Part of guide gallery, tagged as boat |

---

### 1.5 External Reviews (MVP)

At launch we'll have zero native reviews. To build trust from day one, we import/display external reviews:

| Source | How | Display |
|---|---|---|
| **Google Business** | Link to guide's Google profile + show aggregate rating | "4.9 ★ on Google (47 reviews) → See reviews" |
| **Other portals** | Guide provides links during onboarding (FishingBooker, TripAdvisor, etc.) | "Also reviewed on: FishingBooker (4.7 ★), TripAdvisor (5.0 ★)" |

**Rules:**
- We display external ratings as badges/links, we don't scrape full review text (copyright)
- Guide provides the links; admin verifies they're real
- Once our own review system has enough volume, external reviews move to secondary position
- Native FjordAnglers reviews always appear first when available

---

### 1.6 Trip Cards (on Guide Profile)

The guide profile shows their trips as a grid/list of **trip cards** — compact previews linking to the full trip page.

```
┌────────────────────────────────────┐
│  [TRIP PHOTO]                      │
│                                    │
│  Salmon Fishing Tromsø             │
│  🐟 Salmon · Sea Trout            │
│  ⏱️ 4h / 8h / Full day            │
│  From €250 per group               │
│  Jun → Sep                         │
│              [View Trip →]         │
└────────────────────────────────────┘
```

Each card links to `/trips/[trip-slug]`.

If the guide has no active trips yet, show:
```
Erik hasn't published any trips yet.
Want to hear when they do? Leave your email.
```

---

### 1.7 License Info Section (FjordAnglers Unique)

**No competitor does this.** This is our unfair advantage.

Every guide profile includes a section linked to their operating region:

```
┌─────────────────────────────────────────────┐
│  🎣 Fishing License                         │
│                                             │
│  Erik's trips are in Tromsø Municipality,   │
│  Northern Norway. You'll need a fishing     │
│  license for this area.                     │
│                                             │
│  → View license info for this area          │
│    (links to /license-map?region=tromso)     │
└─────────────────────────────────────────────┘
```

Auto-populated based on guide's region. Links to our License Map with the right zone pre-selected.

---

## PART 2: TRIP PAGE

### What it is

One URL per trip: `/trips/[slug]`
Example: `/trips/salmon-fishing-tromso-erik-hansen`

This page answers: **"Is this the right trip for me? What do I get? How do I book?"**

This is where the action happens — pricing, inclusions, meeting point, and the booking form all live here.

**One trip = one product, with duration/time options.** If a guide offers the same water/species at different durations (4h, 8h, full day), that's ONE trip with selectable options — not three separate trip pages.

---

### 2.1 Trip Header

| Field | Required | Type | Example |
|---|---|---|---|
| Trip name | ✅ | Text (60 char max) | "Salmon Fishing Tromsø" |
| Guide name + photo (linked) | Auto | Links to guide profile | "with Erik Hansen" → `/guides/norway/erik-hansen-tromso` |
| Location | Auto | From guide profile | "Tromsø, Northern Norway" |
| Hero image | ✅ | First trip photo | Full-width banner |
| Rating + review count | Auto | Trip-specific reviews + external |

---

### 2.2 Trip Details & Duration Options

A single trip can offer **multiple duration/time variants** with different prices. The angler selects one.

| Field | Required | Type | Example |
|---|---|---|---|
| Trip name | ✅ | Text (60 char max) | "Salmon Fishing Tromsø" |
| Duration options | ✅ | 1–4 options per trip | See below |
| Max group size | ✅ | Number (1–8) | 4 |
| Target species | ✅ | Multi-select from master list | Salmon, Sea Trout |
| Fishing method | ✅ | Multi-select | Fly fishing, Spinning, Trolling |
| Season | ✅ | Month range | June → September |
| Description | ✅ | Rich text (800 char max) | "We start at the upper pools at dawn..." |

#### Duration Options (per trip)

Each trip has 1–4 duration/price combos. The angler picks one before booking:

```
┌─────────────────────────────────────────────┐
│  Choose your option:                        │
│                                             │
│  ○ Half day (4h)         €250 per group     │
│  ● Full day (8h)         €400 per group     │
│  ○ Extended day (10h)    €500 per group     │
│  ○ 2-day package         €900 per group     │
│                (includes 1 night lodging)   │
└─────────────────────────────────────────────┘
```

This replaces having separate trip pages for the same water at different durations.

---

### 2.3 Group-Size Pricing

Price can vary by group size. Guide sets a price table during onboarding:

```
┌─────────────────────────────────────────────┐
│  Pricing (Full day · 8h):                   │
│                                             │
│  1 angler         €250                      │
│  2 anglers        €350                      │
│  3 anglers        €400                      │
│  4 anglers        €450 (max)                │
└─────────────────────────────────────────────┘
```

**How it works:**
- Guide sets pricing model: **flat rate** (same price regardless of group) OR **per-group-size** (different price per number of anglers)
- For per-group-size: guide fills a price for each group size from 1 to max
- Price shown on trip card = lowest price ("From €250")
- Angler selects group size → price updates in real time

This is how FishingBooker and Captain Experiences handle it. Essential for boat trips where adding anglers costs the guide almost nothing.

---

### 2.4 Trip Photo Gallery

| Spec | Details |
|---|---|
| Minimum photos | 2 (enforced) |
| Maximum photos | 15 |
| Format | WebP (auto-converted) |
| Display | Carousel on mobile, grid on desktop |

These photos are about **the trip** — the river, the catches, the scenery, the boat in action. Different from guide-level photos.

---

### 2.5 "What's Included" & "What's Not Included"

*Inspired by: Tom's Catch (clearest standard), FishingBooker (dual sections)*

Two separate, clearly labeled sections on every trip page.

#### What's Included — Checklist Items

| Item | Guide toggles on/off |
|---|---|
| Fishing guide | Always on (non-toggleable) |
| Fishing rods & reels | ✅ Toggle |
| Tackle & lures | ✅ Toggle |
| Bait (live/artificial) | ✅ Toggle |
| Boat & fuel | ✅ Toggle |
| Safety equipment (life jackets) | ✅ Toggle |
| Fishing license | ✅ Toggle |
| Lunch / snacks | ✅ Toggle |
| Drinks | ✅ Toggle |
| Fish cleaning & packing | ✅ Toggle |
| Transport to fishing spot | ✅ Toggle |
| Accommodation | ✅ Toggle (multi-day only) |
| Custom item (free text) | ✅ Up to 3 custom items |

#### What's NOT Included — Auto-generated + custom

The system auto-generates "Not included" items based on what's toggled off. Guide can add custom items like:
- "Fishing license (buy at [link])" → **links to our License Map**
- "Personal gear (waders, rain jacket)"
- "Travel to/from meeting point"
- "Meals on multi-day trips (local restaurant available)"

**Cross-sell opportunity:** When "Fishing license" is NOT included, we auto-link to `/license-map` with the relevant region pre-selected. No competitor does this.

---

### 2.6 Meeting Point

| Field | Details |
|---|---|
| Display | Map pin + text address |
| When shown | **Always visible** on trip page (unlike Captain Experiences/Tom's Catch which hide until after booking) |
| Why visible | Transparency is our brand. Anglers plan logistics — they need to know where they're going before committing. |
| Implementation | Google Maps embed or Mapbox pin |
| Per-trip override | Each trip can have its own meeting point (e.g., river trips vs sea trips start at different spots). Falls back to guide's default if not set. |

---

### 2.7 Cancellation Policy Display

*Visible on every trip page, before any booking action. MVP feature — guide picks one of three presets during onboarding.*

Displayed as a simple, human-readable box:

```
┌─────────────────────────────────────────────┐
│  📋 Cancellation Policy: Moderate           │
│                                             │
│  Free cancellation up to 14 days before     │
│  your trip. After that, the deposit is      │
│  non-refundable.                            │
│                                             │
│  Bad weather? Always a full refund or       │
│  reschedule — no questions asked.           │
└─────────────────────────────────────────────┘
```

Policy is set at guide level (not per trip) — all of a guide's trips share the same cancellation policy. Guide picks during onboarding: **Flexible** (7 days), **Moderate** (14 days), or **Strict** (30 days).

---

### 2.8 License Info (on Trip Page)

Same logic as guide profile, but trip-specific:

```
┌─────────────────────────────────────────────┐
│  🎣 Fishing License                         │
│                                             │
│  You need a fishing license for this area.  │
│  This trip is in Tromsø Municipality,       │
│  Northern Norway.                           │
│                                             │
│  → View license info for this area          │
│                                             │
│  ℹ️ License included in trip price? No      │
│     (See "What's included" above)           │
└─────────────────────────────────────────────┘
```

---

### 2.9 Booking Section

This section sits on the trip page. It adapts based on the guide's payment mode:

**Option A: Full Platform Pay** (guide has Stripe Connect):
```
┌─────────────────────────────────────────────┐
│  Book This Trip                             │
│                                             │
│  Option: [Full day (8h) ▼]                  │
│  Date: [calendar picker]                    │
│  Group size: [1-4]    → Price: €400         │
│  Special requests: [optional text]          │
│                                             │
│  💳 Pay €120 deposit now                    │
│  Remaining €280 charged 48h before trip     │
│                                             │
│  [Book This Trip →]                         │
└─────────────────────────────────────────────┘
```

**Option B: Booking Fee** (guide without Stripe):
```
┌─────────────────────────────────────────────┐
│  Book This Trip                             │
│                                             │
│  Option: [Full day (8h) ▼]                  │
│  Date: [calendar picker]                    │
│  Group size: [1-4]    → Price: €400         │
│  Special requests: [optional text]          │
│                                             │
│  💳 Booking fee: €60 (confirms your spot)   │
│  Trip price: €400 (pay guide directly)      │
│                                             │
│  ℹ️ The booking fee is non-refundable.      │
│  You'll pay the trip price directly to      │
│  Erik on the day.                           │
│                                             │
│  [Confirm Booking →]                        │
└─────────────────────────────────────────────┘
```

See PART 5 for full payment model details.

---

### 2.10 "More Trips by This Guide"

At the bottom of every trip page, show 2–3 other trips by the same guide as cards. Keeps the angler in the ecosystem if this specific trip isn't right for them.

---

## PART 3: SEARCH & FILTERS

### 3.1 Search Bar (Homepage + /trips)

**Primary search:** Location-based
Input: Country or region (autocomplete from our guide locations)
E.g., "Norway", "Northern Norway", "Tromsø", "Sweden", "Lofoten"

Search results show **trip cards**, not guide cards. The guide is context (name + photo + rating) on the trip card.

### 3.2 Filters (ALL MVP)

Every filter ships in MVP. No post-MVP filters.

| Filter | Type | Notes |
|---|---|---|
| **Country** | Select: Norway / Sweden / Finland / Iceland | Primary filter |
| **Region** | Select (depends on country) | E.g., Northern Norway, Southern Sweden |
| **Species** | Multi-select checkboxes | From master species list |
| **Price range** | Slider (€0–€2,000) | Trip price (shows "from" lowest option) |
| **Group size** | Number input (1–8) | Filters trips accepting this size |
| **Trip duration** | Select: Half day / Full day / Multi-day | |
| **Fishing method** | Multi-select: Fly / Spinning / Trolling / Ice | |
| **Date** | Calendar picker | Requires availability system |
| **Languages spoken** | Multi-select: EN / DE / PL / NO / SE / FI | From guide profile |
| **Instant Book** | Toggle | Only shows trips with instant-confirm |
| **Map view** | Toggle list ↔ map | Mapbox or Google Maps |
| **Payment type** | Toggle: "Pay online" / "All" | Filters by Full Platform Pay vs all |

### 3.3 Search Results Card (Trip Card)

```
┌──────────────────────────────────────────┐
│  [TRIP PHOTO]                            │
│                                          │
│  Salmon Fishing Tromsø                   │
│  with Erik Hansen 📸 ⭐ 4.8     🇳🇴      │
│  Tromsø, Northern Norway                 │
│  ────────────────────────────            │
│  🐟 Salmon · Sea Trout                   │
│  ⏱️ 4h / 8h / Full day                  │
│  👥 Up to 4 anglers                      │
│  Jun → Sep                               │
│  ────────────────────────────            │
│  From €250 per group   [View Trip →]     │
│  💳 Book online                          │
└──────────────────────────────────────────┘
```

The "💳 Book online" badge only appears for guides with Full Platform Pay (Stripe). Booking Fee trips show "📋 Booking fee" instead. Helps anglers see at a glance what the payment situation is.

---

## PART 4: BOOKING FLOW

### No more Tier 1 (contact-only). Every guide gets booking.

The old Tier 1 (€20/mo listing, contact form only) is removed. Every guide has a booking flow — the difference is how payment works.

---

### 4.1 Payment Options Overview

| | **Option A: Full Platform Pay** | **Option B: Booking Fee** |
|---|---|---|
| **Guide setup** | Stripe Connect Express connected | No Stripe — guide opts out |
| **What angler pays online** | 30% deposit now + 70% auto-charged 48h before | 15% booking fee (8% commission + 7% service fee) |
| **What angler pays to guide** | Nothing (all through Stripe) | Full trip price directly (cash, transfer, etc.) |
| **FjordAnglers revenue** | 10% commission (8% for founding guides) taken from Stripe payout | The 15% booking fee (kept entirely by FjordAnglers) |
| **Refund control** | Full — deposit + balance refundable via Stripe | Booking fee only — trip price is between guide & angler |
| **Weather Guarantee** | Full (all money refundable) | Booking fee refundable only |
| **Cancellation enforcement** | Full — system manages deposit/balance | Booking fee non-refundable after deadline; guide handles trip price |
| **Guide is merchant of record** | Yes (via Stripe Connect) | Yes (they receive cash/transfer directly) |

---

### 4.2 Option A: Full Platform Pay (Guide has Stripe)

```
STEP 1: SELECT (on Trip Page)
──────────────────────────────
Angler lands on trip page
  → Selects duration option (if multiple)
  → Selects group size → price updates
  → Picks a date from availability calendar
  → Adds special requests (optional free text)

STEP 2: REVIEW & PAY
────────────────────
Booking summary page:
  - Trip: Salmon Fishing Tromsø with Erik Hansen
  - Option: Full day (8h)
  - Date: June 15, 2026
  - Group: 2 anglers → €350
  - Deposit now: €105 (30%)
  - Remaining: €245 (charged 48h before trip)
  - Cancellation: Free cancellation until June 1

  → "What's included" summary
  → "Cancellation policy" summary
  → "Meeting point" with map

  [Pay €105 deposit →]  (Stripe Checkout)

STEP 3: GUIDE CONFIRMS
──────────────────────
Guide receives notification (email + app push in future)
  → 24 hours to confirm or decline
  → If declined: angler gets full refund, shown similar trips
  → If no response in 24h: auto-declined, angler refunded

STEP 4: CONFIRMED
─────────────────
Both parties receive confirmation:
  - Booking details
  - Meeting point + map
  - Guide's contact info (phone/email)
  - "Message your guide" link
  - Calendar invite (.ics attachment)
  - License reminder: "Don't forget your fishing license! → /license-map"

STEP 5: PRE-TRIP
────────────────
48 hours before trip:
  → Remaining balance (€245) auto-charged to angler's card
  → Guide receives payout confirmation
  → Angler receives "You're all set!" email with final details

STEP 6: POST-TRIP
─────────────────
24 hours after trip:
  → Angler receives "How was your trip?" email → leave review
  → Guide receives payout (minus 10% platform fee)
```

---

### 4.3 Option B: Booking Fee (Guide without Stripe)

```
STEP 1: SELECT (on Trip Page)
──────────────────────────────
Same as Option A — angler picks option, group size, date

STEP 2: REVIEW & PAY BOOKING FEE
─────────────────────────────────
Booking summary page:
  - Trip: Salmon Fishing Tromsø with Erik Hansen
  - Option: Full day (8h)
  - Date: June 15, 2026
  - Group: 2 anglers → €350
  - Booking fee: €52.50 (15% — confirms your spot)
  - Trip price: €350 (pay directly to Erik)

  ℹ️ "The booking fee confirms your reservation.
  You'll pay the trip price (€350) directly to Erik
  on the day of your trip."

  [Confirm Booking — Pay €52.50 →]  (Stripe Checkout)

STEP 3: GUIDE CONFIRMS
──────────────────────
Same 24-hour window as Option A.
  → If declined: booking fee refunded

STEP 4: CONFIRMED
─────────────────
Both parties receive confirmation:
  - Booking details
  - Meeting point + map
  - Guide's contact info
  - "Payment: You'll pay €350 directly to Erik"
  - Calendar invite (.ics)
  - License reminder

NO STEP 5 (no pre-trip charge — the angler pays the guide directly)

STEP 6: POST-TRIP
─────────────────
Same as Option A — review request email
```

---

### 4.4 Why We Chose These Decisions

| Decision | What we chose | Why |
|---|---|---|
| **No more Tier 1** | Every guide gets booking, not just a contact form | Contact-only is a dead end. Guides without Stripe still get real bookings via the Booking Fee model. |
| **Two payment modes** | Full Platform Pay vs Booking Fee | Lowers the barrier for guides who don't want Stripe, while still generating revenue. |
| **15% booking fee (8% + 7%)** | FjordAnglers keeps all 15% from booking fee mode | 8% is equivalent to the guide commission; 7% is angler service fee for the booking convenience. |
| **Booking fee non-refundable** | After cancellation deadline, booking fee is lost | Clear and simple. The fee is for the booking service, not the trip. |
| **Confirmation window** | 24 hours | Anglers booking Scandinavian trips are time-pressed. |
| **Group-size pricing** | Price varies by group size | Essential for boat trips. Standard on FishingBooker and Captain Experiences. |
| **Duration options on one page** | 1 trip = 1 page with selectable durations | Cleaner than 3 separate pages for 4h/8h/full-day of the same water. |

---

## PART 5: PAYMENT MODEL

### 5.1 Option A: Full Platform Pay Architecture

```
Angler pays  →  Stripe Checkout  →  Guide's Stripe Connect Express account
                                          ↓
                                  FjordAnglers takes application_fee
                                  (10% standard / 8% founding)
```

**Guide is merchant of record.** FjordAnglers never holds funds.

### 5.2 Option B: Booking Fee Architecture

```
Angler pays  →  Stripe Checkout  →  FjordAnglers account
                                          ↓
                                  FjordAnglers keeps 100% of booking fee
                                  (15% of trip price: 8% commission + 7% service)

Trip price: Angler pays guide directly (cash / bank transfer / Vipps / whatever)
            → Not FjordAnglers' problem
```

**FjordAnglers is merchant of record for the booking fee only.** The trip payment is a direct transaction between angler and guide.

### 5.3 Payment Timing

**Option A (Full Platform Pay):**

| Event | What happens | When |
|---|---|---|
| **Booking** | Deposit charged (30% default) | Immediately |
| **48h before trip** | Remaining balance auto-charged | Automated |
| **Trip completed** | Guide payout (minus 10%/8%) | T+2 business days |
| **Cancellation (outside window)** | Full refund | 5–7 business days |
| **Cancellation (inside window)** | Deposit kept by guide | Automatic |

**Option B (Booking Fee):**

| Event | What happens | When |
|---|---|---|
| **Booking** | Booking fee charged (15%) | Immediately |
| **Trip day** | Angler pays guide directly | Between them |
| **Cancellation (outside window)** | Booking fee refunded | 5–7 business days |
| **Cancellation (inside window)** | Booking fee non-refundable | — |

### 5.4 Payment Methods

| Method | MVP | Notes |
|---|---|---|
| Credit/debit card (Visa, MC, Amex) | ✅ | Both options |
| Apple Pay | ✅ | Via Stripe |
| Google Pay | ✅ | Via Stripe |
| iDEAL (Netherlands) | ✅ | Via Stripe |
| Przelewy24 (Poland) | ✅ | Key for PL market |
| SOFORT/Klarna (Germany) | ✅ | Key for DE market |
| Installments (FlexPay) | Post-MVP | For multi-day trips over €500 |

### 5.5 Currency

- **All prices displayed in EUR** (primary currency)
- Post-MVP: NOK, SEK, PLN, GBP display with live conversion
- Guide always receives EUR (or their chosen currency via Stripe)

### 5.6 Tipping

Post-MVP feature. Digital tipping via Stripe after trip completion. Optional, not prompted aggressively. "Tipping is not expected in Scandinavia, but always appreciated."

---

## PART 6: CANCELLATION & REFUND POLICY

### 6.1 Framework

**Core principle:** The guide sets their own cancellation policy from three presets. FjordAnglers provides the framework. Cancellation enforcement differs by payment option.

### 6.2 Guide-Set Cancellation Window (MVP)

Each guide chooses ONE preset during onboarding (applies to all their trips):

| Policy | Free cancellation until | After deadline |
|---|---|---|
| **Flexible** | 7 days before trip | Deposit / booking fee non-refundable |
| **Moderate** | 14 days before trip | Deposit / booking fee non-refundable |
| **Strict** | 30 days before trip | Deposit / booking fee non-refundable |

**Why presets (not custom)?**
FishingBooker allows 1–60 days custom — this creates confusion. Presets are clearer for anglers and simpler for guides.

### 6.3 Cancellation Scenarios

**Option A (Full Platform Pay):**

| Scenario | What happens | Money |
|---|---|---|
| Angler cancels OUTSIDE window | Full refund | Deposit returned via Stripe |
| Angler cancels INSIDE window | Deposit forfeited | Deposit goes to guide; balance never charged |
| Angler no-show | Same as inside-window | Deposit goes to guide |
| Guide cancels | Full refund always | Platform initiates refund |
| Weather / safety | Full refund OR reschedule | Weather Guarantee (full) |

**Option B (Booking Fee):**

| Scenario | What happens | Money |
|---|---|---|
| Angler cancels OUTSIDE window | Booking fee refunded | FjordAnglers refunds the 15% |
| Angler cancels INSIDE window | Booking fee non-refundable | FjordAnglers keeps fee |
| Guide cancels | Booking fee refunded | FjordAnglers refunds |
| Weather / safety | Booking fee refunded | No control over any cash already paid to guide |

### 6.4 Weather Guarantee ⛈️

```
┌─────────────────────────────────────────────┐
│  ⛈️ FjordAnglers Weather Guarantee          │
│                                             │
│  If your guide cancels due to unsafe        │
│  weather, you get a full refund or free     │
│  reschedule — your choice, no questions.    │
│                                             │
│  💳 Full Platform Pay: Full trip refunded   │
│  📋 Booking Fee: Booking fee refunded       │
└─────────────────────────────────────────────┘
```

**Rules:**
- Only the **guide** can trigger a weather cancellation
- Guide is not penalized
- Option A: full refund (deposit + balance) or reschedule
- Option B: booking fee refunded. Trip price (cash) is between guide and angler — we make this clear on the trip page before booking
- This is a **platform-level guarantee**

**Why this matters:**
Norwegian/Swedish weather is unpredictable. Anglers flying from Poland/Germany need confidence weather won't cost them money. For Booking Fee trips, we're upfront that only the booking fee is covered.

### 6.5 Extenuating Circumstances

Covers: medical emergency, travel restrictions, death in family, natural disaster.

**Process:**
1. Contact FjordAnglers support with documentation
2. Review within 72 hours
3. If approved: full refund regardless of policy
4. Guide not penalized

### 6.6 Guide Cancellation Penalties

| Occurrence | Consequence |
|---|---|
| 1st cancellation | Warning email + coaching |
| 2nd (within 6 months) | Profile rank drop in search |
| 3rd (within 6 months) | "High cancellation rate" badge |
| 4+ or pattern | Account review → potential suspension |

Weather cancellations never count.

---

## PART 7: ICELANDIC FLOW (Concierge / Custom Trips)

### What it is

A separate flow for complex, curated trips — starting with Iceland. FjordAnglers acts as a concierge: matching the angler to the right river, outfitter, guide, and handling license logistics.

This is NOT the standard trip page flow. It's a form-based request that the FjordAnglers team handles manually.

### Why Iceland?

Icelandic salmon fishing is expensive (€1,000–€10,000+ per rod/day), highly regulated (limited rod licenses per river), and complex to organize (outfitters control access, not individual guides). It doesn't fit the standard guide → trip model.

### Route: `/plan-your-trip`

Also reachable as `/iceland` or `/custom` (redirects).

### Flow

```
STEP 1: REQUEST FORM
────────────────────
Angler fills in:
  - Dates (flexible / specific)
  - Target species (Salmon / Trout / Arctic Char / Sea Trout)
  - Experience level (Beginner / Intermediate / Expert)
  - Group size
  - Budget range (€1,000–€3,000 / €3,000–€5,000 / €5,000–€10,000 / €10,000+)
  - Preferences:
    - River type (big river / small stream / lake)
    - Accommodation (lodge / cabin / camping / don't care)
    - Fly-fishing only? (yes/no)
  - Special requests (free text)
  - Contact info (name, email, phone)

STEP 2: TEAM REVIEW
───────────────────
FjordAnglers team (Krzychu + network) reviews the request:
  - Matches river(s) based on species, dates, budget
  - Contacts outfitter to check availability
  - Checks license availability for requested dates
  - Builds a personalized package

STEP 3: CUSTOM OFFER
────────────────────
Personalized offer sent to angler (email + dashboard if post-MVP):
  - River: Laxá í Adaldal, Northern Iceland
  - Dates: July 10–13, 2026
  - Outfitter: Strengur Angling
  - Accommodation: Laxá Lodge (3 nights)
  - Rods: 2 per day
  - Includes: Guide, fishing license, lunch, transfers
  - Price: €6,400 per rod
  - Cancellation terms (custom, set by outfitter)

STEP 4: ANGLER ACCEPTS
──────────────────────
Angler reviews offer and accepts
  → Payment collected (method TBD — deposit or full, depends on outfitter terms)

STEP 5: TRIP CONFIRMED
──────────────────────
Full confirmation with:
  - Detailed itinerary
  - Meeting point + transfers
  - Equipment recommendations
  - License confirmation
  - Emergency contacts
```

### Revenue Model (Concierge)

TBD — options:
1. Commission from outfitter (10–15%)
2. Service fee from angler (flat or percentage)
3. Both (margin on package)

This is manually operated for now. No Stripe automation needed. Scale later if volume justifies.

### MVP Scope

For MVP, this is just a **form + email** flow. No dashboard, no automated matching. The form collects the request; the team handles everything via email. The page itself is a beautiful, inspiring landing page about Iceland fishing with the form at the bottom.

---

## PART 8: POST-TRIP

### 8.1 Reviews (MVP — with external sources)

| Aspect | Our approach |
|---|---|
| Who can review | Anglers with completed bookings (both payment options) |
| Where reviews appear | On the **trip page** + rolled up on guide profile |
| Rating | 1–5 stars |
| Categories | Overall, Communication, Knowledge, Value |
| Guide response | Guide can respond publicly (not edit/delete) |
| Moderation | FjordAnglers removes fake/abusive reviews |
| External reviews | Google rating badge + links to other portal reviews on guide profile |

### 8.2 Trip Photos

Post-trip, guides can upload trip photos tagged to the booking. These appear in the trip's gallery. Builds social proof.

---

## PART 9: SUPABASE SCHEMA

### 9.1 Trips Table

```sql
-- Trips (independent entities, each with own page/slug)
CREATE TABLE trips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id            UUID REFERENCES guides(id) ON DELETE CASCADE,
  slug                TEXT NOT NULL UNIQUE,             -- 'salmon-fishing-tromso-erik-hansen'
  name                TEXT NOT NULL,                    -- "Salmon Fishing Tromsø"
  max_group_size      INTEGER NOT NULL DEFAULT 4,
  species             TEXT[],                           -- ARRAY['salmon', 'sea_trout']
  fishing_methods     TEXT[],                           -- ARRAY['fly', 'spinning']
  season_start        INTEGER,                          -- month number: 6
  season_end          INTEGER,                          -- month number: 9
  description         TEXT,                             -- max 800 chars

  -- Trip-specific meeting point (overrides guide default if set)
  meeting_point_lat   DECIMAL(10,7),
  meeting_point_lng   DECIMAL(10,7),
  meeting_point_address TEXT,

  -- Status & ordering
  is_active           BOOLEAN DEFAULT true,
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

### 9.2 Duration Options (per trip, 1–4 options)

```sql
CREATE TABLE trip_duration_options (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,               -- "Half day", "Full day", "2-day package"
  duration_hours  INTEGER,                     -- 4, 8, 10, NULL for multi-day
  is_multi_day    BOOLEAN DEFAULT false,
  multi_day_nights INTEGER,                    -- NULL if not multi-day
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 9.3 Group-Size Pricing (per duration option)

```sql
-- Pricing can be flat or per-group-size
-- If pricing_model = 'flat': only 1 row with group_size = max_group_size
-- If pricing_model = 'per_group_size': 1 row per possible group size
CREATE TABLE trip_prices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duration_option_id  UUID REFERENCES trip_duration_options(id) ON DELETE CASCADE,
  group_size          INTEGER NOT NULL,          -- 1, 2, 3, 4
  price_eur           DECIMAL(10,2) NOT NULL,    -- 250.00
  UNIQUE(duration_option_id, group_size)
);
```

### 9.4 Other Trip Tables

```sql
-- Trip Photos (separate from guide photos)
CREATE TABLE trip_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID REFERENCES trips(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt_text    TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- What's Included (per trip)
CREATE TABLE trip_inclusions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE,
  item            TEXT NOT NULL,
  is_included     BOOLEAN NOT NULL,
  custom_note     TEXT,
  sort_order      INTEGER DEFAULT 0
);

-- Standard inclusion items (seeded):
-- fishing_guide, fishing_rods, tackle_lures, bait, boat_fuel,
-- safety_equipment, fishing_license, lunch_snacks, drinks,
-- fish_cleaning, transport, accommodation
```

### 9.5 Bookings (both payment options)

```sql
CREATE TABLE bookings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                 UUID REFERENCES trips(id),
  guide_id                UUID REFERENCES guides(id),
  duration_option_id      UUID REFERENCES trip_duration_options(id),
  angler_name             TEXT NOT NULL,
  angler_email            TEXT NOT NULL,
  angler_phone            TEXT,
  trip_date               DATE NOT NULL,
  group_size              INTEGER NOT NULL,
  special_requests        TEXT,

  -- Payment mode
  payment_mode            TEXT CHECK (payment_mode IN ('full_platform', 'booking_fee')) NOT NULL,

  -- Pricing (Option A: full_platform)
  total_price_eur         DECIMAL(10,2),           -- full trip price
  deposit_amount_eur      DECIMAL(10,2),           -- 30% deposit
  balance_amount_eur      DECIMAL(10,2),           -- 70% remaining
  platform_fee_eur        DECIMAL(10,2),           -- 10% or 8%

  -- Pricing (Option B: booking_fee)
  booking_fee_eur         DECIMAL(10,2),           -- 15% of trip price
  trip_price_eur          DECIMAL(10,2),           -- guide's price (paid directly)

  -- Status
  status                  TEXT CHECK (status IN (
    'pending_confirmation',
    'confirmed',
    'deposit_paid',
    'balance_paid',
    'completed',
    'cancelled_by_angler',
    'cancelled_by_guide',
    'cancelled_weather',
    'declined_by_guide',
    'expired',
    'refunded'
  )) DEFAULT 'pending_confirmation',

  -- Stripe
  stripe_payment_intent_id  TEXT,
  stripe_deposit_charge_id  TEXT,
  stripe_balance_charge_id  TEXT,
  stripe_booking_fee_charge_id TEXT,              -- Option B only

  -- Timestamps
  confirmed_at        TIMESTAMPTZ,
  deposit_paid_at     TIMESTAMPTZ,
  balance_charged_at  TIMESTAMPTZ,
  booking_fee_paid_at TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

### 9.6 Concierge Requests (Icelandic Flow)

```sql
CREATE TABLE concierge_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  angler_name         TEXT NOT NULL,
  angler_email        TEXT NOT NULL,
  angler_phone        TEXT,
  dates_flexible      BOOLEAN DEFAULT true,
  date_start          DATE,
  date_end            DATE,
  species             TEXT[],
  experience_level    TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'expert')),
  group_size          INTEGER,
  budget_range        TEXT CHECK (budget_range IN (
    '1000_3000', '3000_5000', '5000_10000', '10000_plus'
  )),
  river_preference    TEXT,                    -- 'big_river', 'small_stream', 'lake'
  accommodation_pref  TEXT,                    -- 'lodge', 'cabin', 'camping', 'any'
  fly_only            BOOLEAN DEFAULT false,
  special_requests    TEXT,

  -- Status
  status              TEXT CHECK (status IN (
    'new', 'in_review', 'offer_sent', 'accepted', 'declined', 'expired'
  )) DEFAULT 'new',

  -- Admin notes
  assigned_to         TEXT,                    -- team member handling
  notes               TEXT,
  offer_details       TEXT,                    -- the custom offer sent back
  offer_sent_at       TIMESTAMPTZ,

  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

### 9.7 Guides Table Updates

```sql
ALTER TABLE guides ADD COLUMN deposit_percentage INTEGER DEFAULT 30
  CHECK (deposit_percentage IN (20, 30, 40, 50));
ALTER TABLE guides ADD COLUMN payment_mode TEXT
  CHECK (payment_mode IN ('full_platform', 'booking_fee'))
  DEFAULT 'booking_fee';                         -- default to booking_fee (lower barrier)
ALTER TABLE guides ADD COLUMN has_stripe_connected BOOLEAN DEFAULT false;
ALTER TABLE guides ADD COLUMN stripe_account_id TEXT;
ALTER TABLE guides ADD COLUMN cancellation_policy TEXT
  CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict'))
  DEFAULT 'moderate';
ALTER TABLE guides ADD COLUMN languages TEXT[] DEFAULT ARRAY['en'];
ALTER TABLE guides ADD COLUMN years_experience INTEGER;
ALTER TABLE guides ADD COLUMN tagline TEXT;
ALTER TABLE guides ADD COLUMN bio TEXT;
ALTER TABLE guides ADD COLUMN specialties TEXT[];
ALTER TABLE guides ADD COLUMN certifications TEXT[];
ALTER TABLE guides ADD COLUMN meeting_point_lat DECIMAL(10,7);
ALTER TABLE guides ADD COLUMN meeting_point_lng DECIMAL(10,7);
ALTER TABLE guides ADD COLUMN meeting_point_address TEXT;
ALTER TABLE guides ADD COLUMN license_map_region TEXT;

-- Boat details (optional — only for boat-based guides)
ALTER TABLE guides ADD COLUMN has_boat BOOLEAN DEFAULT false;
ALTER TABLE guides ADD COLUMN boat_name TEXT;
ALTER TABLE guides ADD COLUMN boat_type TEXT;
ALTER TABLE guides ADD COLUMN boat_length_m DECIMAL(4,1);
ALTER TABLE guides ADD COLUMN boat_engine TEXT;
ALTER TABLE guides ADD COLUMN boat_capacity INTEGER;

-- External reviews
ALTER TABLE guides ADD COLUMN google_review_url TEXT;
ALTER TABLE guides ADD COLUMN google_rating DECIMAL(2,1);
ALTER TABLE guides ADD COLUMN google_review_count INTEGER;
ALTER TABLE guides ADD COLUMN external_review_links JSONB DEFAULT '[]';
  -- [{"platform": "FishingBooker", "url": "...", "rating": 4.7}]
```

---

## PART 10: ROUTES

```
/                              Homepage + search
/trips                         Trip search results (primary search landing)
/trips/[slug]                  Individual trip page (booking happens here)
/guides                        Guide directory (browse all guides)
/guides/[country]/[slug]       Individual guide profile (bio, trips listed)
/plan-your-trip                Concierge / custom trip request (Iceland, etc.)
/license-map                   Interactive license map
/admin                         Admin panel (protected)
/admin/guides                  Guide management
/admin/trips                   Trip management
/admin/bookings                Booking management
/admin/concierge               Concierge request pipeline
/api/stripe/webhook            Stripe webhook handler
```

---

## PART 11: MVP FEATURES (Everything below ships at launch)

No more MVP/post-MVP split for core features. Everything listed is MVP.

| Feature | Status |
|---|---|
| Guide profile page (bio, photos, languages, specialties, boat details) | ✅ MVP |
| External reviews (Google + portal links) on guide profile | ✅ MVP |
| Trip pages with duration options + group-size pricing | ✅ MVP |
| What's included / not included (per trip) | ✅ MVP |
| Trip photo gallery | ✅ MVP |
| Meeting point + map (per trip, with guide fallback) | ✅ MVP |
| License info section → License Map link | ✅ MVP |
| All search filters (country, region, species, price, group, duration, method, date, languages, instant book, map, payment type) | ✅ MVP |
| Search results as trip cards | ✅ MVP |
| Cancellation policy presets (Flexible / Moderate / Strict) | ✅ MVP |
| Option A: Full Platform Pay (Stripe Connect, deposit + balance) | ✅ MVP |
| Option B: Booking Fee (15%, no Stripe for guide) | ✅ MVP |
| 24h guide confirmation | ✅ MVP |
| Weather Guarantee (full for Option A, booking fee for Option B) | ✅ MVP |
| Email notifications (confirmation, reminder, review request) | ✅ MVP |
| Calendar invite (.ics) | ✅ MVP |
| Concierge / Plan Your Trip page (form + email flow) | ✅ MVP |
| Native reviews (after completed bookings) | ✅ MVP |
| Przelewy24 + SOFORT/Klarna payments | ✅ MVP |

### Post-MVP (future iterations)

| Feature | Priority |
|---|---|
| Concierge dashboard (replace email with admin UI) | High |
| FlexPay / installments (for trips over €500) | Medium |
| In-app messaging (guide ↔ angler) | Medium |
| Multi-language (DE, PL) | Medium |
| Digital tipping | Low |
| Shared trips (anglers join group) | Low |
| Loyalty program | Low |

---

## PART 12: COPY & UX GUIDELINES

### Booking flow copy examples

**"Book Now" button:**
❌ "Reserve Your Exclusive Experience"
✅ "Book This Trip"

**Deposit explanation (Option A):**
❌ "A non-refundable deposit secures your reservation."
✅ "Pay €105 now to lock in your spot. The rest (€245) is charged 48 hours before your trip."

**Booking fee explanation (Option B):**
❌ "A service fee is required to confirm your booking."
✅ "Pay €52.50 to confirm your spot. You'll pay the trip price (€350) directly to Erik on the day."

**Cancellation policy:**
❌ "Please review our comprehensive cancellation and refund policy terms."
✅ "Free cancellation until June 1. After that, you keep the trip or lose the deposit."

**Weather guarantee:**
❌ "In the event of adverse meteorological conditions..."
✅ "Bad weather? Full refund or reschedule — your call."

**Post-booking confirmation:**
❌ "Your reservation has been successfully confirmed."
✅ "You're going fishing! Erik confirmed your trip. Here's everything you need to know."

**License reminder:**
❌ "Please ensure you have obtained the necessary fishing permits."
✅ "Don't forget your fishing license! Here's where to get one for Tromsø → [License Map]"

**Search empty state:**
❌ "No results found for your query."
✅ "No trips in this area yet. We're adding new guides every week — leave your email and we'll let you know."

**Concierge page:**
❌ "Submit your bespoke travel request to our dedicated concierge team."
✅ "Tell us what you're looking for. We'll find the right river, the right guide, and handle the logistics."

---

*End of spec v3. Next steps: Team review → prioritize → build.*
