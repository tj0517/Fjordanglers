# FjordAnglers — MVP Scope (aktualny stan)

> Aktualizacja: 2026-03-20 · Odzwierciedla aktualnie zbudowane funkcjonalności

---

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Język | TypeScript strict mode |
| Stylowanie | Tailwind CSS v4 |
| Typografia | DM Sans (`f-display` + `f-body`) |
| Baza danych | Supabase (Postgres + Auth + Storage + Realtime) |
| Płatności | Stripe Connect (Elements + Checkout) |
| Hosting | Vercel |

---

## Zbudowane funkcjonalności

### 1. Strony publiczne
- **Homepage** (`/`) — hero z wyszukiwarką, featured trips
- **Trip listing** (`/trips`) — search + filtry (kraj, gatunek, metoda, poziom, miesiąc)
- **Trip detail** (`/trips/[id]`) — galeria, opis, pakiety, przewodnik, booking widget
- **Guide profile** (`/guides/[id]`) — bio, tripy, certyfikaty, lokalizacja
- **Plan Your Trip** (`/plan-your-trip`) — concierge flow dla złożonych tripów
- **License Map** (`/license-map`) — interaktywna mapa stref wędkarskich
- **Legal** — `/legal/privacy-policy`, `/legal/terms-of-service`

### 2. Booking flow (`direct`)
- **Checkout** (`/book/[expId]`) — Stripe Elements, walidacja terminów
- **Server Action** `createBooking()` — PaymentIntent z `transfer_data`, idempotency key
- **Webhook** (`/api/stripe/webhook`) — `payment_intent.succeeded` → booking `confirmed` + transfer
- **Angler bookings** (`/account/bookings`) — lista z statusami
- **Booking detail** (`/account/bookings/[id]`) — szczegóły + chat

### 3. Inquiry flow (`icelandic` / `both`)
- **Inquiry form** (`/trips/[id]/inquire`) — 4-tabowy wizard (Trip / Group / Needs / Extras)
  - Inline `DateRangePicker` (visual calendar z range selection)
  - Per-experience field visibility config (`InquiryFormConfigEditor`)
  - Walidacja per-tab z error dots
- **Guide dashboard inquiries** (`/dashboard/inquiries`) — lista z filtrami statusów
- **Inquiry detail** (`/dashboard/inquiries/[id]`) — tabbed view + offer form
  - "What they need" summary w prawej kolumnie
  - `GuideOfferForm` → `sendOfferByGuide()` Server Action
  - Keyboard navigation (← →) między zapytaniami
  - `InquiryDeclineButton` z 2-step confirm
- **Angler trips** (`/account/trips`) — lista zapytań anglera
- **Trip detail** (`/account/trips/[id]`) — status oferty + `AcceptOfferButton` → Stripe Checkout

### 4. Real-time booking chat
- Tabela `booking_messages` z Supabase Realtime (`postgres_changes INSERT`)
- Dostępny w `/dashboard/bookings/[id]` (guide) i `/account/bookings/[id]` (angler)
- Optimistic UI, auto-scroll, Enter=wyślij, Shift+Enter=nowa linia
- Character counter przy >1800 znakach

### 5. Guide Dashboard (`/dashboard/`)
- **Overview** (`/dashboard`) — statystyki, ostatnie bookings, quick actions, Stripe banner
- **Bookings** (`/dashboard/bookings`) — tabela z unified view (direct + inquiry bookings)
- **Booking detail** (`/dashboard/bookings/[id]`) — info + accept/decline + chat
- **Calendar** (`/dashboard/calendar`) — per-trip chips, multi-calendar (agency mode)
  - Block day / range / month
  - Per-trip color palette
  - Listings filter pills
  - `CalendarsPanel` — tworzenie/edycja/usuwanie kalendarzy + przypisywanie tripów
- **Inquiries** (`/dashboard/inquiries`) — filter tabs, counts, keyboard nav
- **Trips** (`/dashboard/trips`) — lista tripów z booking counts
- **Trip edit** (`/dashboard/trips/[id]/edit`) — ExperienceForm 5-zakładkowy wizard
- **Earnings** (`/dashboard/earnings`) — monthly bar chart + per-experience breakdown
- **Profile** (`/dashboard/profile`) — edycja profilu przewodnika

### 6. Angler Dashboard (`/account/`)
- **Bookings** (`/account/bookings`) — lista direct bookings + inquiry bookings
- **Booking detail** (`/account/bookings/[id]`) — cover, guide card, chat
- **Trips** (`/account/trips`) — lista zapytań/inquiry tripów
- **Trip detail** (`/account/trips/[id]`) — offer status, accept button

### 7. Auth
- `/login`, `/signup` — Supabase Auth
- Middleware: redirect po auth, `refresh_token_not_found` handling
- Terms acceptance checkboxes w onboardingu

### 8. Admin
- `/admin/inquiries` — kolejka zapytań (admin wysyła oferty przez `sendOffer()`)

---

## Routing (kompletna mapa)

```
/                                    Homepage
/trips                               Trip listing
/trips/[id]                          Trip detail
/trips/[id]/inquire                  Inquiry form (angler)
/guides                              Guide directory
/guides/[id]                         Guide profile
/plan-your-trip                      Concierge form
/license-map                         License map
/book/[expId]                        Booking checkout

/account/bookings                    Angler bookings list
/account/bookings/[id]               Booking detail + chat
/account/trips                       Angler inquiries list
/account/trips/[id]                  Inquiry detail + accept offer

/dashboard                           Guide overview
/dashboard/bookings                  Guide bookings
/dashboard/bookings/[id]             Booking detail + chat
/dashboard/calendar                  Availability calendar
/dashboard/inquiries                 Inquiry queue
/dashboard/inquiries/[id]            Inquiry detail + offer form
/dashboard/trips                     Trip management
/dashboard/trips/[id]/edit           Edit trip
/dashboard/earnings                  Payout overview
/dashboard/profile                   Guide profile edit

/admin/inquiries                     Admin: inquiry queue
/admin/inquiries/[id]                Admin: inquiry detail + send offer

/api/stripe/webhook                  Stripe webhook handler

/legal/privacy-policy
/legal/terms-of-service

/login
/signup
```

---

## Zasady deweloperskie

- **Mobile-first** — Safari iOS jako główny target
- **GDPR od dnia zero** — cookie consent (GTM), data minimization
- **RLS zawsze włączone** — Supabase Row Level Security na każdej tabeli
- **Server Components domyślnie** — `"use client"` tylko gdy konieczne
- **`pnpm typecheck` = 0 błędów** przed każdym commitem
- **Idempotency keys** na każdym PaymentIntent: `booking-${booking.id}`
- **serviceClient** dla operacji omijających RLS (admin/webhook)

---

## Supabase migracje (wykonane)

```
20260319192731_add_guide_calendars.sql       guide_calendars + calendar_experiences
20260320120000_add_booking_messages.sql      booking_messages + RLS + Realtime
20260320130000_bookings_nullable_experience  experience_id nullable, inquiry_id FK
20260320140000_booking_messages_replica_identity
20260320150000_experiences_inquiry_form_config  inquiry_form_config jsonb column
```
