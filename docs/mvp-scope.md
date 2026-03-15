# FjordAnglers — MVP Scope

> Source: `head/mvp-scope.pdf`

---

## Success Metric

**Weekly organic traffic trend** (measured via Google Search Console + Vercel Analytics)

Everything in the MVP is designed to drive and convert organic search traffic.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (Postgres + Auth + Storage) |
| Payments | Stripe Connect |
| Hosting | Vercel |

---

## Must-Have Features (MVP)

### 1. Homepage with Search
- Hero section with search/filter
- Target keywords: "fishing guide Norway", "salmon fishing Sweden", etc.
- Mobile-first (Safari iOS primary target)

### 2. Guide Profiles + Trip Pages (Split Architecture)
- **Guide profile** (`/guides/[country]/[slug]`): bio, experience, photos, external reviews (Google, etc.), trust signals, list of trip cards
- **Trip page** (`/trips/[slug]`): the bookable product — duration options, group-size pricing, inclusions, meeting point, booking form
- Search results show **trip cards** (not guide cards)
- SEO-optimized URLs for both guides and trips

### 3. Booking Flow
- Two payment options per guide:
  - **Full Platform Pay** — 10% commission, Stripe Connect (30% deposit + 70% balance)
  - **Booking Fee** — 15% fee (8% commission + 7% service fee) to FjordAnglers, full trip price paid directly to guide
- Cancellation policy presets: Flexible (7 days), Moderate (14 days), Strict (30 days)
- Weather Guarantee (admin-triggered)
- Booking confirmation emails

### 4. Search & Filters (All MVP)
- Country, species, fishing method, date range, price range, group size, boat/shore, duration, guide language

### 5. Plan Your Trip (Concierge / Icelandic Flow)
- Form-based request for complex custom trips (Iceland salmon, multi-river packages)
- Fields: dates, species, experience level, group size, budget range, preferences
- Admin reviews and sends manual offer via email
- Route: `/plan-your-trip`

### 6. License Map
- Interactive map of Scandinavian fishing zones
- "Where to buy" links per zone
- Species and season info per zone
- **This is a key SEO page** — targets "fishing license Norway tourist" queries

### 7. Admin Panel
- Guide profile management (create, edit, verify, suspend)
- Trip management (create, edit, pricing)
- Booking management (view, cancel, trigger Weather Guarantee)
- Concierge request queue (review, assign, send offers)
- Lead tracking (Instagram DM outreach pipeline)
- Featured ads management

---

## Dev Principles

- **Mobile-first** — Safari iOS is the primary test target
- **GDPR compliant from day one** — cookie consent, data minimization
- **"Ship fast, iterate later"** — no gold-plating, no premature optimization
- **RLS always on** — Supabase Row Level Security enabled for every table
- **Server Components by default** — `"use client"` only when necessary
- **No pages/ router** — App Router only

---

## Out of Scope for MVP

- Guide self-serve onboarding — manual admin onboarding only
- Native reviews and ratings — using external reviews (Google, etc.) at launch
- Multi-language (German, Polish) — post-launch
- Mobile app — post-launch
- Angler accounts / login — post-MVP
- Messaging / chat between angler and guide — post-MVP

---

## Key Pages / Routes

```
/                              Homepage + search
/trips                         Trip search results (primary search landing)
/trips/[slug]                  Individual trip page (booking here)
/guides                        Guide directory (browse all)
/guides/[country]/[slug]       Individual guide profile (bio + trip cards)
/plan-your-trip                Concierge / Icelandic Flow
/license-map                   Interactive license map
/admin                         Admin panel (protected)
/admin/guides                  Guide management
/admin/trips                   Trip management
/admin/bookings                Booking management
/admin/concierge               Concierge request queue
/admin/leads                   Lead pipeline
/api/stripe/webhook            Stripe webhook handler
```

> **Architecture note:** Guide profiles and trips are separate pages.
> Guides = bio, experience, trust signals. Trips = the product (duration options, group-size pricing, booking).
> Search results show trip cards, not guide cards. Plan Your Trip = concierge for complex custom trips.
