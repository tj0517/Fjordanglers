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

### 2. Guide Profiles (Listing Tier)
- Public profile page per guide
- Contact form (no booking flow needed for listing tier)
- SEO-optimized URLs: `/guides/[country]/[name]`

### 3. License Map
- Interactive map of Scandinavian fishing zones
- "Where to buy" links per zone
- Species and season info per zone
- **This is a key SEO page** — targets "fishing license Norway tourist" queries

### 4. Admin Panel
- Guide profile management (create, edit, verify, suspend)
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

- Guide onboarding (self-serve) — manual admin onboarding only
- Booking flow for Tier 2 — post-MVP
- Reviews and ratings — post-MVP
- Multi-language (German, Polish) — post-launch
- Mobile app — post-launch

---

## Key Pages / Routes

```
/                          Homepage + search
/guides                    Guide listing/search results
/guides/[slug]             Individual guide profile
/license-map               Interactive license map
/admin                     Admin panel (protected)
/admin/guides              Guide management
/admin/leads               Lead pipeline
/api/stripe/webhook        Stripe webhook handler
```
