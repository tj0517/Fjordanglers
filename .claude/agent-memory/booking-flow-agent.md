# booking-flow-agent — pamięć

## Status
Sesja 5 — calendar: multi-kalendarze (agency mode), listings filter pills, Block▾ dropdown, unblock spinner, idempotent upsert, RLS fix, refresh_token fix. typecheck ✅ 0 błędów.

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

### Sesja 4 — Calendar UX + Build fixes

#### Calendar dodatkowe features
- **Clear button** w selection mode header — `setSelectedDays(new Set())`, zostaje w trybie zaznaczania
- **Block month button** (salmon color) — otwiera modal blokowania całego bieżącego miesiąca
  - `openMonthModal()` — default: wszystkie tripy, puste reason
  - `handleMonthBlock()` — `blockDates({ dateStart: 'YYYY-MM-01', dateEnd: 'YYYY-MM-DD', experienceIds })`
  - Modal: read-only date badge, trip checkboxes, reason input, dynamiczny label ("Block all of March" / "Block March for N trips")
- **Per-trip colored chips** w komórkach dnia — dot w kolorze tripu + pierwsza nazwa tripu (truncate)
- **Dwurzędowa legenda** — kolory tripów (nazwy) + klucz statusów

#### Build fixes
- **`env.ts`** — `NEXT_PHASE === 'phase-production-build'` skip Zod validation (runtime secrets niedostępne w build)
- **`/api/stripe/webhook/route.ts`** — `export const dynamic = 'force-dynamic'`
- **`species/[slug]/page.tsx`** — usunięto `generateStaticParams` (ISR via `revalidate`, nie potrzeba Supabase w build)

#### Mobile overflow fix (guides/[id])
- `items-start` → `lg:items-start` na głównym flex container
- `w-full` na thumbnail strip w ExperienceGallery
- `break-words` na bio i fact values

### Sesja 5 — Multi-calendar (agency mode) + Calendar UX

#### Bug fixes
- **`audit_trigger_fn()`** — `OLD.user_id`/`NEW.user_id` → `auth.uid()` (experiences ma `guide_id` nie `user_id`); `RETURN NEW` → `RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END`
- **`refresh_token_not_found`** — `src/lib/supabase/middleware.ts` dodano check: `signOut({ scope: 'local' })` + redirect `/login`; projekt używa `src/proxy.ts` (nie standardowego middleware.ts)
- **Idempotent blocking** — `insert()` → `upsert({ onConflict: 'experience_id,date_start,date_end', ignoreDuplicates: true })` w `blockDates` i `blockMultipleDates`

#### Calendar UX
- **Listings pill-strip** ponad gridem — filtruje które tripy widać w komórkach (nie w headerze)
- **Block ▾ dropdown** w headerze — łączy "Block season" + "Block month" w jedno menu
- **Fixed cell height** `height: '80px'` — eliminuje viewport jump przy zmianie filtra
- **Unblock spinner** — per-block `unblockingId` state; stan "usuwania" trzymany do momentu `router.refresh()` (nie czyszczony na success)

#### Multi-calendar (agency mode)
- **`supabase/migrations/20260319192731_add_guide_calendars.sql`** — tabele `guide_calendars` + `calendar_experiences` z RLS
- **`src/actions/calendars.ts`** — CRUD: `createCalendar`, `updateCalendar`, `deleteCalendar`, `setCalendarExperiences` + fetche `getGuideCalendars`, `getCalendarExperienceMap`
- **`src/components/dashboard/calendars-panel.tsx`** — sidebar: create/rename/delete kalendarzy + checkboxy przypisywania listingów; stan: `idle | creating | editing | confirming-delete`
- **`src/app/dashboard/calendar/page.tsx`** — two-column layout; filtruje experiences przez `?calendarId=xxx`; empty state gdy brak listingów w kalendarzu
- ⚠️ `as any` casty na `guide_calendars`/`calendar_experiences` — usunąć po regeneracji `database.types.ts`

#### Wymagana akcja — migracja
```bash
supabase db push
# lub wklej SQL z supabase/migrations/20260319192731_add_guide_calendars.sql w Dashboard
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

## Stan typechecku
`pnpm typecheck` → 0 błędów (sesja 5).

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
