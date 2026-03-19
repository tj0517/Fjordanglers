# booking-flow-agent — pamięć

## Status
Sesja 3 — calendar redesign ukończony. Poprzednie sesje: guide dashboard, booking flow edge cases.

## Zrealizowane zadania

### Sesja 1–2 (UI fixes + guide dashboard)

#### Naprawione stylingi
- **booking-widget.tsx** — stepper counter: `flex items-center gap-2` + `lineHeight: '1'` zamiast inline spans z różnym font-size
- **booking-widget.tsx** — dropdown panel: background `#FDFAF7`, `p-1.5`, itemy z `rounded-xl` + hover, usunięte `borderBottom` separatory
- **plan-your-trip/page.tsx** — ten sam fix steppera
- **trips/sort-select.tsx** — `appearance-none` + custom chevron SVG wrapper
- **experience-form.tsx** — `StyledSelect` component: `appearance-none`, `inputBase` style, focus/blur borderColor, custom chevron; użyty w MonthSelect i Country select
- **dashboard/profile/page.tsx** — z-index bug: `relative z-10` na flex row z awatarem (cover photo `div.relative` przykrywało awatar)

#### Guide Dashboard — ukończony
- **sidebar.tsx** — kompletny rewrite z mobile support:
  - 7 aktywnych linków (Overview exact, Listings, Bookings, Inquiries, Calendar, Earnings, Profile)
  - Mobile top bar h-14 z hamburgerem
  - Slide-in sidebar CSS translateX
  - Overlay + body scroll lock
- **layout.tsx** — `<main className="lg:ml-[240px] pt-14 lg:pt-0">`
- **dashboard/page.tsx** — pełna strona Overview:
  - greet() (morning/afternoon/evening)
  - Stripe setup banner gdy stripe_charges_enabled === false
  - 4 klikalne stat karty (live trips, pending, upcoming, month earnings)
  - Recent bookings list (ostatnie 6) z kolorowymi statusami
  - Prawa kolumna: upcoming trips z date badge + quick actions
  - Promise.all z 5 Supabase queries

#### Strony dashboardu — wszystkie zaimplementowane
- `/dashboard/bookings/page.tsx` — tabela z BookingActions (accept/decline dla pending)
- `/dashboard/calendar/page.tsx` — CalendarGrid + CalendarModeToggle
- `/dashboard/earnings/page.tsx` — monthly bar chart + per-experience breakdown
- `/dashboard/inquiries/page.tsx` — lista z linkami do `/dashboard/inquiries/[id]`

### Sesja 3 — Legal pages + Auth + GTM + Calendar redesign

#### Legal pages (zrealizowane)
- `/legal/privacy-policy/page.tsx` — 16 sekcji, tabele (ProcessingTable, SharingTable, RetentionTable)
- `/legal/terms-of-service/page.tsx` — 27 sekcji, CancellationMode grid, WarningCard, BulletList
- Footer: Terms of Service · Privacy Policy · Cookie Policy linki
- Wszystkie emaile: `contact@fjordanglers.com`

#### Terms acceptance checkboxes
- `BookingCheckoutForm.tsx` — termsAccepted state + checkbox + disabled submit
- `onboarding-wizard.tsx` — krok 3 (Review) + checkbox z "commission structure and payout terms"
- `apply-form.tsx` — checkbox przed submittem
- `create-guide-form.tsx` — termsConfirmed + checkbox z dynamicznym imieniem przewodnika

#### GTM
- `cookie-banner.tsx` — zmienione z GA4 na GTM, consent-gated noscript iframe
- `layout.tsx` — `NEXT_PUBLIC_GTM_ID` zamiast `NEXT_PUBLIC_GA_ID`
- Env var do dodania: `NEXT_PUBLIC_GTM_ID=GTM-KFMMHGW8`

#### Auth redirect
- `login-form.tsx` + `auth-tabs.tsx` — default next: `/account` → `/dashboard`

#### Calendar redesign
- **`calendar/page.tsx`** — usunięto `CalendarModeToggle`, zawsze `calendarMode="shared"`, usunięto guidePrefs query
- **`calendar-grid.tsx`**:
  - `TRIP_PALETTE` — 5 brandowych kolorów per trip (`#1B4F72`, `#0891B2`, `#059669`, `#7C3AED`, `#BE185D`)
  - `expColors` useMemo — mapuje experience.id → kolor z palety
  - Day cells: per-trip colored chips zamiast generic "Booked/Blocked" (8px dot + pierwsza nazwa tripu)
  - Legend: 2 rzędy — trip colour key (z nazwami tripów) + status key (Confirmed/Pending/Blocked)
  - Wszystkie modaly (block day, multi-pick, range/season): **checkboxy per trip** zamiast "block all" info badge
  - `handleBlock/handleMultiBlock/handleRangeBlock` — używają bezpośrednio state (blockExpIds, multiBlockExpIds, rangeExpIds), usunięto `isShared` override
  - Default: wszystkie tripy zaznaczone przy otwarciu modalu
  - Przyciski: "Block all trips" gdy wszystkie zaznaczone, "Block N trips" gdy wybór częściowy

## Stan typechecku
`pnpm typecheck` → 0 błędów po wszystkich zmianach (sesja 3).

## Do zrobienia (booking flow właściwy)
- `src/actions/bookings.ts` — Server Action `createBooking()` z Stripe PaymentIntent
- `/api/webhooks/stripe/route.ts` — webhook handler
- `/experiences/[id]` page — server component + `BookingForm` client component ze Stripe Elements
- `/dashboard/bookings` — angler view (osobna ścieżka lub rozszerzenie)
- `src/lib/pricing.ts` — `calculateBookingPrice()` function

## Wzorzec cenowy
```typescript
// Jeden model: tylko komisja
// Standard: 10% | Founding Guide: 8% przez pierwszy rok
const rate = Number(env.PLATFORM_COMMISSION_RATE)
const platformFeeEur = Math.round(totalEur * rate * 100) / 100
```

## Edge cases do pamiętania
- Idempotency key: `booking-${booking.id}` na PaymentIntent
- Sprawdzaj dostępność terminu PRZED tworzeniem PaymentIntent
- Guide bez aktywnego Stripe → blokuj booking z komunikatem
- Webhook duplikat → sprawdzaj aktualny status przed UPDATE
- flat_fee: transfer w webhook `payment_intent.succeeded`; commission: auto przez `application_fee_amount`
