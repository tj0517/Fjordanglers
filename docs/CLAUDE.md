# FjordAnglers — Project Memory

## What is FjordAnglers?
A marketplace connecting Central European anglers (Poland, Germany, Czech Republic) with Scandinavian fishing guides. Built by Tymon (CEO/Product), Lukasz (Content/Brand), and Krzychu (Fishing Knowledge/Guide Verification).

## Key Docs (in `fjordanglers-docs/`)
- **brand.md** — Brand identity, tone of voice, colors, logo variants, typography
- **business-model.md** — Problem, solution, revenue model (Full Platform Pay 10% vs Booking Fee 15%), Founding Guide offer
- **gtm.md** — Go-to-market: supply-first (Instagram DM outreach), SEO flywheel for demand, 3-phase launch
- **mvp-scope.md** — Tech stack (Next.js 14, TypeScript, Tailwind, Supabase, Stripe, Vercel), MVP features, dev principles
- **listing-booking-spec.md** — Full product spec: guide profiles, trip pages, booking flow, payments, cancellation, Supabase schema
- **remotion-scenario-guides.md** — 75-second promo video scenario for guide recruitment (9 scenes, Remotion components)

## Brand Quick Reference
- **Colors:** Fjord Blue `#0A2E4D`, Salmon `#E67E50`, Ice White `#F8FAFB`
- **Font:** Inter
- **Tone:** Friendly, concrete, direct — like a friend who's been there. No corporate/travel-brochure language.
- **Mission:** "Connecting anglers with the best fishing experiences in the world — starting from Scandinavia."

## Revenue Model (v3 — updated 2026-03-13)
- **Legal position:** FjordAnglers = advertising/discovery platform, NOT a travel agency. Guide is always the seller.
- **Every guide gets booking** — no contact-only tier.
- **Option A — Full Platform Pay:** 10% commission. Angler pays via Stripe Connect (30% deposit + 70% balance). Guide is merchant of record.
- **Option B — Booking Fee:** 15% fee (8% commission + 7% service fee) paid by angler to FjordAnglers at booking. Full trip price paid directly to guide (cash/transfer). No Stripe needed for guide.
- **Founding Guide (first 50):** 3 months free + reduced rates for first 24 months (8% Option A / 12% Option B, time-boxed).

## Tech Stack
Next.js 14 (App Router) · TypeScript · Tailwind + shadcn/ui · Supabase · Stripe Connect · Vercel

## Target Market
- **Anglers:** Polish, German, Czech aged 30-55
- **Guides:** Norwegian, Swedish, Finnish fishing guides
- **Species:** Salmon, Trout, Pike, Perch, Zander, Arctic Char

## GTM Strategy
1. Pre-launch: Instagram DM outreach to guides (50%+ response rate), Founding Guide deal
2. Soft launch: SEO-optimized guide profiles + License Map + light Meta ads
3. Full launch: Multi-language (DE/PL), broader paid acquisition, PR

## Architecture: Guides, Trips, Concierge
- **Guide profile** (`/guides/[country]/[slug]`) = bio, experience, photos, external reviews (Google etc.), trust signals, list of trip cards
- **Trip page** (`/trips/[slug]`) = the product — duration options, group-size pricing, inclusions, meeting point, booking form
- **Plan Your Trip** (`/plan-your-trip`) = Icelandic Flow / concierge for complex custom trips (form → manual review → offer)
- Search results show **trip cards** (not guide cards). The guide is context, the trip is the product.

## MVP Key Routes
```
/                              Homepage + search
/trips                         Trip search results
/trips/[slug]                  Individual trip page (booking here)
/guides                        Guide directory
/guides/[country]/[slug]       Guide profile
/plan-your-trip                Concierge / Icelandic Flow
/license-map                   Interactive license map
/admin                         Admin panel
/admin/guides                  Guide management
/admin/trips                   Trip management
/admin/bookings                Booking management
/admin/concierge               Concierge request queue
/api/stripe/webhook            Stripe webhook handler
```

## Current Phase
Pre-launch — building supply side (guide profiles)
