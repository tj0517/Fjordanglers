# FjordAnglers — Site Map

## Public Pages

| Route | Status | Description |
|---|---|---|
| `/` | ✅ Built | Homepage — video hero, species picker, featured experiences, how it works, guide CTA |
| `/experiences` | ✅ Built | Experience listing — sticky filters (country, species, difficulty, sort), 3-col grid |
| `/experiences/[id]` | ✅ Built | Experience detail — hero image, description, included/excluded, booking widget, guide card, related trips |
| `/guides` | ✅ Built | Guide directory — filter by country, language; 3-col card grid with cover image, avatar, fish pills, rating |
| `/guides/[id]` | ✅ Built | Guide profile — hero cover, bio, expertise, experience cards grid, sticky contact sidebar |
| `/license-map` | 🔲 To build | Interactive map — fishing zones, license info, where to buy (key SEO page) |

## Auth

| Route | Status | Description |
|---|---|---|
| `/login` | ✅ Built | Sign in — email + password, Supabase signInWithPassword, redirect to /dashboard |
| `/register` | ✅ Built | Angler registration — full name + email + password, Supabase signUp, confirm email state |
| `/forgot-password` | ✅ Built | Password reset request — sends Supabase reset email |
| `/reset-password` | ✅ Built | Set new password — reads token from URL hash, updates via Supabase updateUser |

## Guide Onboarding

| Route | Status | Description |
|---|---|---|
| `/guides/apply` | ✅ Built | Guide application — 5-step wizard (plan, profile, expertise, story, review) + Server Action → leads table |

## Guide Dashboard

| Route | Status | Description |
|---|---|---|
| `/dashboard` | ✅ Built | Overview — bookings summary, earnings snapshot |
| `/dashboard/experiences` | ✅ Built | Guide's experience list |
| `/dashboard/bookings` | ✅ Built | Bookings management |
| `/dashboard/earnings` | ✅ Built | Earnings & payouts |
| `/dashboard/profile` | ✅ Built | Edit guide profile |
| `/dashboard/experiences/new` | 🔲 To build | Create new experience |
| `/dashboard/experiences/[id]/edit` | 🔲 To build | Edit experience |

## Booking Flow

| Route | Status | Description |
|---|---|---|
| `/book/[id]` | 🔲 To build | Booking form — date, guests, Stripe Checkout |
| `/book/[id]/confirm` | 🔲 To build | Booking confirmation page |

## Admin

| Route | Status | Description |
|---|---|---|
| `/admin` | 🔲 To build | Admin overview (Krzychu) |
| `/admin/guides` | 🔲 To build | Guide management — verify, suspend, edit |
| `/admin/leads` | 🔲 To build | Instagram outreach pipeline |
| `/admin/experiences` | 🔲 To build | Experience moderation |

## API Routes

| Route | Status | Description |
|---|---|---|
| `/api/stripe/webhook` | 🔲 To build | Stripe Connect webhook handler |
| `/api/stripe/connect` | 🔲 To build | Stripe Connect onboarding redirect |

---

## Build Priority

1. **Phase 1 — Public** ✅ `/` · `/experiences` · `/experiences/[id]`
2. **Phase 2 — Onboarding** ✅ `/guides/apply` + leads DB
3. **Phase 3 — Dashboard** ✅ `/dashboard` · `/dashboard/experiences` · `/dashboard/bookings` · `/dashboard/earnings` · `/dashboard/profile`
4. **Phase 4 — Auth** ✅ `/login` · `/register` · `/forgot-password` · `/reset-password`
5. **Phase 5 — Guides directory** ✅ `/guides` · `/guides/[id]`
6. **Phase 6 — Booking** 🔲 `/book/[id]`
7. **Phase 7 — Webhooks** 🔲 `/api/stripe/*`
8. **Phase 8 — Admin** 🔲 `/admin/*`
9. **Phase 9 — License Map** 🔲 `/license-map`
