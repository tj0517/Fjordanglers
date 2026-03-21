# booking-flow-agent — pamięć

## Status
Sesja 27 — closeModal() przed router.refresh() w handleUnblock + handleUnblockSelected (DONE). Eliminuje flash starego stanu po unblock. typecheck ✅ 0 errors.

Sesja 26 — Overlap guard na blockDates + blockMultipleDates (DONE). Dla każdego listingu każdy dzień może mieć co najwyżej jedną blokadę. typecheck ✅ 0 errors.

Sesja 25 — Schedule UX improvement (DONE). Diagonal stripe background już był (schedStripe). Dokończono: (1) onMouseEnter używa schedStripeHov zamiast solid color, (2) chip "Sched" → "Weekly off" (w-full, justify-center, rgba(99,102,241,0.18), #4338CA), (3) legenda: "recurring weekly pattern" → "recurring weekly off". typecheck ✅ 0 errors.

### Sesja 26 — Overlap guard (no duplicate blocks per day per listing)
- **Problem**: `upsert ON CONFLICT (experience_id, date_start, date_end)` chronił tylko przed dokładnym duplikatem — nie przed nakładającymi się zakresami. Range Jan–Dec + osobna blokada May 5 = 2 wiersze na ten dzień.
- **`blockDates`**: przed insertem query `lte('date_start', dateEnd) && gte('date_end', dateStart)` → Set pokrytych experienceIds → insert tylko `toInsert` (uncovered). Jeśli wszystkie już pokryte → `return { success: true }`.
- **`blockMultipleDates`**: jeden bulk query (min–max date range) → `Set<"expId::date">` pokrytych par → filtruje każdą (experience, date) kombinację przed insertem. Obsługuje range-bloki (np. Jan–Dec zawiera 30 zaznaczonych dni → wszystkie pominięte).
- Istniejące duplikaty w DB NIE są automatycznie czyszczone — wymagałoby jednorazowego SQL cleanup.

Sesja 24 — showCalendarToggle fix (DONE). Root cause "nie mogę wyłączyć toggle off": gdy calendar_disabled=true I guide ma classic/both listing, `showCalendarToggle = !hasClassicListing = false` → toggle ukryty → nie można wyłączyć. Fix: `showCalendarToggle = !hasClassicListing || calendarDisabled`. Dodano warning banner "restore date picker". Sesja 23 (poprzednia): RLS fix na service client + useEffect sync + auto-reset przy create/update. typecheck ✅ 0 errors.

### Sesja 25 — Schedule block UX improvement
- **Cel**: "shedule powinno miec bardziej jasne ux bo aktualnie nie wyglada jakby blokowalo caly dzien"
- Diagonal stripe background (`schedStripe`) był już ustawiony z poprzedniej sesji
- `onMouseEnter`: zmieniono `'rgba(99,102,241,0.11)'` → `schedStripeHov` (gęstsza wersja paska)
- Chip: `"Sched"` → `"Weekly off"` z `w-full justify-center` (span całej szerokości komórki), tło `rgba(99,102,241,0.18)` (było 0.10), kolor `#4338CA` (był #4F46E5)
- Legenda: `'recurring weekly pattern'` → `'recurring weekly off'`

### Sesja 23 — Calendar disabled toggle fixes
- **Bug 1 (toggleCalendarDisabled)**: `requireGuide()` używało user-scoped client → RLS na `guides` blokował UPDATE silently (0 rows, error=null). Fix: service client po auth check + `.select('id')` żeby wykryć 0-row update.
- **Bug 2 (UI desync)**: `useState(currentlyDisabled)` inicjalizuje się tylko raz (mount). Po `router.refresh()` prop zmienia się ale stan nie. Fix: `useEffect(() => setLocalDisabled(currentlyDisabled), [currentlyDisabled])` w `CalendarDisabledToggle`.
- **Bug 3 (auto-reset)**: Gdy guide dodaje listing `classic`/`both` przy `calendar_disabled=true`, DB nie było resetowane. Fix: `resetCalendarDisabledIfNeeded(guideId, bookingType)` — service client, tylko jeśli faktycznie `calendar_disabled=true`, wywołane po create i update (jeśli `payload.booking_type` podany).

### Sesja 22 — Range block split unblock (DONE)

### Sesja 22 — Range block split (właściwy fix)
- Sesja 21 była workaround (deduplication) — nadal kasowała cały range.
- Nowa action `unblockDaysFromRange`: fetch bloku → oblicz segmenty → delete oryginał → insert segmenty
  - Przykład: range Jan–Dec, unblock Mar 15 → Jan–Mar 14 + Mar 16–Dec
  - Przykład: multi Mar 10 + Mar 20 → Jan–Mar 9 + Mar 11–Mar 19 + Mar 21–Dec
- `handleUnblock`: jeśli `date_start ≠ date_end` → `unblockDaysFromRange(id, [selectedDay])`
- `handleUnblockSelected`: to samo dla każdego zaznaczonego bloku
- `handleMultiUnblock`: buduje `blockOpsMap` — single-day → `unblockDates`, range → `unblockDaysFromRange(id, days[])`
- Usunięte workaroundy: warning pills, "Remove range" button label → z powrotem "Unblock"
- Zachowany: `Range` badge w blocked entry row (informacyjny)

### Sesja 21 — Range block fix + UX (workaround, zastąpiony w sesji 22)
- **Root bug**: `handleMultiUnblock` zbierał ID bloków ze wszystkich zaznaczonych dni. Range-blok (np. Jan–Dec) pojawia się w `blockedEntries` KAŻDEGO dnia z zakresu → ten sam ID wysyłany wielokrotnie do `unblockDates`. Przy jednorazowym kasowaniu DB zwraca ok (nie-istniejący rekord = no-op), ale UI wyglądało jak "cały kalendarz wyczyszczony".

### Sesja 20 — Seria bugfixów calendar_disabled
- **Bug 1** (fixed): calendar/page.tsx — query `select('id, full_name, calendar_disabled')` failował gdy kolumna nie istniała → guide=null → redirect('/dashboard'). Fix: split na 2 queries + `?? false`.
- **Bug 2** (fixed): trips/[id]/page.tsx — `calendar_disabled` nie było w `EXP_SELECT` join → zawsze `undefined` → toggle nie działał. Fix: osobne query po id guide'a.
- **Bug 3** (fixed): booking-widget.tsx + trips/[id]/page.tsx — AvailabilityCalendar/PreviewCalendar pokazywały blocked dates gdy `calendarDisabled=true`. Fix: puste tablice gdy `effectiveType === 'icelandic'`.

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

### Sesja 6 — Inquire page + Inquiries dashboard fix

#### Nowe pliki
- **`src/app/trips/[id]/inquire/page.tsx`** — Server Component; pobiera experience + guide przez `createServiceClient`; parsuje `?dates=...&group=...` z URL; renderuje InquireForm
- **`src/app/trips/[id]/inquire/InquireForm.tsx`** — Client Component z pełnym formularzem: name, email, dateFrom/To, group stepper, species multi-select pills, experience level, notes; calls `submitInquiry`; success state z checkmarkiem

#### Bug fixes
- **`src/app/dashboard/inquiries/page.tsx`** — RLS na `trip_inquiries` blokował użytkownika; fix: po weryfikacji guide identity tworzymy `const serviceClient = createServiceClient()` i oba `.from('trip_inquiries')` selects idą przez serviceClient zamiast user-scoped supabase client
- **`src/components/dashboard/calendar-grid.tsx`** — unblock tylko raz na reload: drugi `useTransition [unblockPending, startUnblock]` + `disabled={unblockingId === b.id || unblockPending}` + `startUnblock(() => router.refresh())`
- **`src/components/dashboard/calendar-grid.tsx`** — confirmed bookings nie widać: dodano `|| status === 'accepted'` do wszystkich miejsc sprawdzających confirmed (acceptBooking() ustawia `'accepted'`, nie `'confirmed'`)
- **`src/app/dashboard/calendar/page.tsx`** — `.in('status', ['pending', 'confirmed', 'accepted'])` (dodano 'accepted')

#### Calendar UX
- **Multiselect unblock** w day detail modal — checkboxy na każdym blocked entry; "Unblock N" button w headerze; individual "Unblock" button chowany gdy jakieś zaznaczone
- **Multi-day unblock** — w selection mode headerze: `blockedCount` zlicza blocked entries z zaznaczonych dni; "Unblock N days" button gdy blockedCount > 0
- **Day cell chips redesign** — zastąpiono nazwy tripów semantycznymi labelami: "👤 Booked" (confirmed/accepted), "👤 Pending" (pending), "● Off" (tylko blocked); legenda zaktualizowana

#### Database types
- **`database.types.ts`** — zregenerowany po migracji `guide_calendars` + `calendar_experiences`; usunięto update banner CLI z końca pliku
- **`src/actions/calendars.ts`** — wszystkie `as any` casty usunięte po regeneracji typów

#### Sesja 6 (cd) — Inquiry detail page management
- **`src/actions/inquiries.ts`** — dodano `declineInquiry()`: guide może odrzucić inquiry/reviewing/offer_sent → status 'cancelled'; auth check (assigned or unassigned); serviceClient
- **`src/components/dashboard/inquiry-decline-button.tsx`** — NEW: 2-step confirm button; decline → router.push('/dashboard/inquiries')
- **`src/app/dashboard/inquiries/[id]/page.tsx`** — pełny rewrite:
  - Fix RLS: inquiry fetch przez `serviceClient`
  - Auto-mark reviewing: jeśli status === 'inquiry' → update do 'reviewing' + `displayStatus = 'reviewing'`
  - Email link: `mailto:` w InfoRow children
  - Trip duration calc z dates_from/dates_to
  - Decline button pod offer form + pod offer_sent banner
  - Tips card dla active inquiries

### Sesja 7 — Confirmed inquiries as bookings (unified view)

#### Problem
`bookings.experience_id` is NOT NULL in DB schema → cannot convert inquiries to booking records without migration.

#### Solution — unified display (no DB migration needed)
- **`/dashboard/bookings/page.tsx`** — rewritten:
  - Imports `createServiceClient` + `env`
  - Parallel fetch: regular bookings + trip_inquiries where `assigned_guide_id = guide.id` AND `status IN ('offer_accepted','confirmed','completed')`
  - `TableEntry = { kind: 'booking' | 'inquiry'; data: BookingRow | InquiryRow }`
  - Unified entries sorted by date descending
  - Inquiry rows show: angler_name, "Custom" badge, date range (dates_from → dates_to), group_size, offer_price_eur, estimated payout (90% of price, marked ≈€), status badge, "View →" link to `/dashboard/inquiries/[id]`
  - Info banner: "N custom trips from inquiry flow — View all requests →"
  - Stats updated: total = bookings + inquiries, confirmed includes both, revenue includes inquiry payout estimates

- **`/account/bookings/page.tsx`** — rewritten:
  - Imports `createServiceClient`
  - Parallel fetch: bookings + inquiries by angler_id AND by angler_email (dedup by id)
  - Statuses fetched: `['offer_accepted','confirmed','completed','cancelled']`
  - Normalised to unified `ListItem` type (kind, thumbUrl, title, guideName, primaryDate, displayDate, anglers, totalEur, status styles, href)
  - Inquiry items: title="Custom Trip", "Custom" badge, link to `/account/trips/[id]`
  - Stats: total/upcoming/totalSpent include inquiries
  - "Next trip" banner updated: considers upcoming confirmed inquiries, clickable link to inquiry detail
  - Right column: added "Custom trips" CTA linking to `/account/trips`

#### Inquiry status flow (full)
1. `inquiry` → auto-set to `reviewing` when guide opens the detail page
2. `reviewing` → `offer_sent` (guide sends offer via GuideOfferForm)
3. `offer_sent` → `offer_accepted` (angler clicks "Accept Offer & Pay" → Stripe Checkout created)
4. `offer_accepted` → `confirmed` (Stripe webhook `checkout.session.completed` with `metadata.inquiryId`)
5. `confirmed` → shows in both guide dashboard and angler bookings

#### Key files
- `/api/stripe/webhook/route.ts` — handles `checkout.session.completed` for both `bookingId` and `inquiryId` in metadata; sets `status: 'confirmed'`
- `/account/trips/[id]/AcceptOfferButton.tsx` → calls `acceptOffer()` → `status: 'offer_accepted'` + Stripe Checkout session
- All serviceClient needed for trip_inquiries (RLS blocks user reads)

### Sesja 8 — Per-booking chat (real-time messaging)

#### Architektura
- **1 wątek per booking** — tabela `booking_messages` z `booking_id FK → bookings`
- **Supabase Realtime** — `postgres_changes INSERT` filtrowany po `booking_id`
- **Server Action** `sendBookingMessage()` — optimistic UI + rollback on error
- **Initial load via serviceClient** (SSR) → hydrated w BookingChat useState
- **Enter = wyślij, Shift+Enter = nowa linia**

#### Nowe pliki
- `supabase/migrations/20260320120000_add_booking_messages.sql` — CREATE TABLE, INDEX, ALTER PUBLICATION supabase_realtime, 4 RLS policies (guide SELECT/INSERT + angler SELECT/INSERT)
- `src/lib/supabase/database.types.ts` — ręcznie dodano `booking_messages` table type (przed `bookings:`)
- `src/actions/bookings.ts` — dodano `sendBookingMessage(bookingId, body)`: auth check, access verify (angler OR guide), insert, revalidatePath
- `src/components/booking/chat.tsx` — Client Component `BookingChat`:
  - props: `bookingId, currentUserId, myName, partnerName, initialMessages`
  - Realtime channel: `booking-chat-${bookingId}`, replaces optimistic placeholder by matching sender+body
  - Optimistic update → rollback on Server Action error
  - Auto-scroll via `ref.scrollIntoView({ behavior: 'smooth' })`
  - Character counter pojawia się przy >1800 znaków
  - Bubble shape: `18px 18px 4px 18px` (me) / `18px 18px 18px 4px` (them)
- `src/app/dashboard/bookings/[id]/page.tsx` — Guide booking detail:
  - Auth: must be guide for this booking
  - 2-column: booking info card (stats, angler card, accept/decline) + BookingChat sticky
  - Initial messages via serviceClient
- `src/app/account/bookings/[id]/page.tsx` — Angler booking detail:
  - Auth: must be angler_id = user.id
  - 2-column: booking info card (cover image, date, guide card, requests) + BookingChat sticky
  - Initial messages via serviceClient

#### Zmiany w istniejących plikach
- `src/app/dashboard/bookings/page.tsx` — Actions column: dodano "View / Chat →" link do `/dashboard/bookings/[id]` dla każdego booking row
- `src/app/account/bookings/page.tsx` — booking items href zmienione z `'#'` na `/account/bookings/${b.id}` (teraz klikalne do detail page z chatem)

#### RLS policies
```sql
-- Guide: SELECT + INSERT (via guides.user_id = auth.uid())
-- Angler: SELECT + INSERT (via bookings.angler_id = auth.uid())
-- sender_id = auth.uid() enforced on INSERT policies
```

#### Wymagana akcja — migracja DB
```bash
# W Supabase Dashboard SQL Editor lub CLI:
supabase db push
# Lub wklej zawartość pliku:
# supabase/migrations/20260320120000_add_booking_messages.sql
```

### Sesja 9 — Inquiries as real DB booking records

#### Problem
Sesja 7 użyła "unified display" (bez DB migration) — ale inquiries nie tworzyły prawdziwych rekordów `bookings`.
Sesja 9 właściwie rozwiązuje problem: accepted inquiry → INSERT do `bookings`.

#### Migracje
- **`supabase/migrations/20260320130000_bookings_nullable_experience.sql`** — NEW:
  ```sql
  ALTER TABLE public.bookings ALTER COLUMN experience_id DROP NOT NULL;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS inquiry_id UUID
    REFERENCES public.trip_inquiries(id) ON DELETE SET NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS bookings_inquiry_id_unique_idx
    ON public.bookings (inquiry_id) WHERE inquiry_id IS NOT NULL;
  ```

#### Nowe pliki
- **`src/lib/create-booking-from-inquiry.ts`** — idempotent helper:
  - Sprawdza istniejący rekord przez `inquiry_id` (safe for webhook retries)
  - Pobiera inquiry + assigned_guide_id + offer_price_eur
  - Oblicza totalEur, commissionRate, platformFeeEur, guidePayoutEur
  - INSERT booking: `experience_id: null`, `inquiry_id`, `status: 'confirmed'`, `confirmed_at: now()`

#### Zaktualizowane pliki
- **`src/lib/supabase/database.types.ts`**:
  - `bookings.Row/Insert/Update.experience_id`: `string` → `string | null`
  - `bookings.Row/Insert/Update.inquiry_id`: `string | null` dodane
  - `booking_messages` table type dodany (sesja 8)

- **`src/app/api/stripe/webhook/route.ts`** — `handleCheckoutCompleted()`:
  - Po `trip_inquiries.update({ status: 'confirmed' })` → `createBookingFromInquiry(inquiryId, db, paymentIntentId)`

- **`src/actions/inquiries.ts`** — `acceptOffer()` direct-confirm path (guide bez Stripe):
  - Po `trip_inquiries.update({ status: 'confirmed' })` → `createBookingFromInquiry(inquiryId, serviceClient, null)`

- **`src/app/dashboard/bookings/page.tsx`** — uproszczony (usunięto unified inquiry display z sesji 7):
  - Jeden query: `bookings` z `experience_id` (może być null)
  - `isCustomTrip = booking.experience_id == null` → "Custom" badge
  - "View / Chat →" link do `/dashboard/bookings/[id]`

- **`src/app/account/bookings/page.tsx`** — uproszczony (usunięto unified display z sesji 7):
  - Jeden query: `bookings` z `include inquiry_id` w select
  - `isCustomTrip = booking.experience_id == null` → "Custom Trip" title
  - Klikalne linki do `/account/bookings/${b.id}`

- **`src/app/dashboard/bookings/[id]/page.tsx`** — dodano `inquiry_id` link do `/dashboard/inquiries/[inquiry_id]`
- **`src/app/account/bookings/[id]/page.tsx`** — dodano `inquiry_id` link do `/account/trips/[inquiry_id]`

- **`src/app/dashboard/trips/page.tsx`** — null guard na `experience_id`:
  ```typescript
  if (b.experience_id != null) {
    bookingCountPerExp[b.experience_id] = (bookingCountPerExp[b.experience_id] ?? 0) + 1
  }
  totalRevenue += b.guide_payout_eur  // inquiry bookings wliczone w revenue
  ```

#### UI: isCustomTrip detection
```typescript
const isCustomTrip = booking.experience_id == null
const expTitle = booking.experience?.title ?? (isCustomTrip ? 'Custom Trip' : '—')
```

#### Dwie ścieżki tworzenia booking z inquiry
1. **Stripe paid** — `checkout.session.completed` webhook → `createBookingFromInquiry(inquiryId, db, paymentIntentId)`
2. **Direct confirm** (guide bez Stripe) — `acceptOffer()` → `createBookingFromInquiry(inquiryId, serviceClient, null)`

#### Wymagana akcja — migracje DB
```sql
-- W Supabase Dashboard SQL Editor:
-- 1) supabase/migrations/20260320120000_add_booking_messages.sql  (sesja 8)
-- 2) supabase/migrations/20260320130000_bookings_nullable_experience.sql  (sesja 9)
```

### Sesja 10 — Inquiry form redesign (rich structured fields)

#### Cel
Przeprojektowanie formularza zapytania — zamiast prostych textboxów, ustrukturyzowane pola z chipami, stepperami i grid-em miesięcy.

#### Zmienione pliki
- **`src/app/trips/[id]/inquire/InquireForm.tsx`** — kompletny rewrite:
  - **Sekcja 1 "Must-have info"** (badge: Required for a quote):
    - Trip type: Half day / Full day / Multi-day (3-chip selektor, dark-filled gdy aktywny)
    - How many days? stepper (2–21) — pojawia się tylko gdy Multi-day
    - Preferred period: domyślnie **grid 18 miesięcy** (kolumny 3/4/6 zależnie od breakpointa) — nie-dokładne daty; przełącznik "I have exact dates" pokazuje stare `<input type="date">` From/To
    - `computeDatesFromMonths()` — pierwszy dzień najwcześniejszego miesiąca → ostatni dzień najpóźniejszego
    - Group size stepper + checkboxy "Includes beginners" / "Includes children"
    - Target species pills (bez zmian)
  - **Sekcja 2 "Pricing details"** (badge: Helps get an accurate quote):
    - Experience level (bez zmian — 3 karty)
    - Gear & tackle: CardSelect 3-way (own / need_some / need_all)
    - Accommodation: CardSelect 3-way (needed / not_needed / flexible)
    - Transport: CardSelect 3-way (need_pickup / self_drive / flexible)
    - Boat preference: optional text input
    - Dietary restrictions / lunch: optional text input
  - **Sekcja 3 "Nice to have"** (collapsible toggle):
    - Where staying: text input
    - Special occasion: Salmon-orange pills (Birthday, Bachelor party, Corporate, Team building, Anniversary)
    - Photography package: 2-way CardSelect (yes/no)
    - Region experience: text input
    - Budget min/max: 2-col number inputs
  - **Notes textarea** na końcu (poza sekcjami)
  - Reużywalne subkomponenty: `SectionCard`, `CardSelect<T extends string>`, `Stepper`

- **`src/actions/inquiries.ts`** — rozszerzono `submitInquirySchema.preferences`:
  - Nowe pola: `durationType`, `numDays`, `flexibleDates`, `preferredMonths`, `hasBeginners`, `hasChildren`, `gearNeeded`, `transport`, `boatPreference`, `dietaryRestrictions`, `stayingAt`, `occasions`, `photographyPackage`, `regionExperience`
  - `accommodation`: `z.union([z.boolean(), z.enum(['needed','not_needed','flexible'])])` (backward compat)
  - Wszystkie stare pola zachowane (`budgetMin`, `budgetMax`, `riverType`, `notes`)

- **`src/app/dashboard/inquiries/[id]/page.tsx`** — rozszerzono widok przewodnika:
  - `prefs` type cast rozszerzony o wszystkie nowe pola
  - `tripDays` — używa `prefs.numDays` jeśli dostępny, fallback na obliczenie z dat
  - Mapowania etykiet: `durationTypeLabel`, `gearLabel`, `transportLabel`, `accommodationLabel` (handle boolean + string)
  - **Trip Details** — dodano: Trip type, Preferred months (format "Jul 2026, Aug 2026"), Group z "incl. beginners / children"
  - **Logistics & Pricing Info** — nowa sekcja zamiast starej "Preferences": gear, accommodation, transport, boat, dietary, budget, riverType
  - **Context** — nowa sekcja: stayingAt, occasions, photographyPackage, regionExperience, notes

#### Zasada data-flow dat
- Flexible mode → `selectedMonths[]` → `computeDatesFromMonths()` → `datesFrom = YYYY-MM-01`, `datesTo = YYYY-MM-DD` (last day of latest month)
- Exact mode → user picks `<input type="date">` → bezpośrednio do `datesFrom`/`datesTo`
- `preferences.flexibleDates = true/false` zawsze zapisane
- `preferences.preferredMonths = ['2026-07', '2026-08']` (tylko gdy flexible)

### Sesja 11 — Per-experience inquiry form field visibility config

#### Cel
Przewodnik może ustawić dla każdego ogłoszenia czy dany field jest `required` / `optional` / `hidden`.

#### Nowe pliki
- **`src/lib/inquiry-form-config.ts`** — typy (`FieldVisibility`, `InquiryFormConfig`), domyślna konfiguracja (`DEFAULT_INQUIRY_FORM_CONFIG`), `resolveFormConfig(partial)`, metadane grup (`FIELD_GROUPS`)
- **`supabase/migrations/20260320150000_experiences_inquiry_form_config.sql`** — `ALTER TABLE experiences ADD COLUMN inquiry_form_config jsonb`
- **`src/actions/inquiry-form-config.ts`** — `updateInquiryFormConfig(expId, config)`: auth check (guide ownership OR admin), `.update({ inquiry_form_config: config })`, revalidatePath
- **`src/components/trips/InquiryFormConfigEditor.tsx`** — Client Component:
  - `FieldRow` — field label + description + 3 pill buttons (Required/Optional/Hidden)
  - Pill colors: Required=dark #0A2E4D, Optional=salmon rgba(230,126,80), Hidden=muted gray
  - 4 grupy pól z group headers
  - "Always required" info box (dates, group size, species — nie konfigurowalne)
  - Legend z opisem każdego stanu
  - "N custom" badge przy nagłówku gdy są overrides
  - "Reset to defaults" button (disabled gdy bez overrides)
  - "Save settings" button z isPending + "Saved ✓" / error feedback

#### Zmodyfikowane pliki
- **`src/lib/supabase/database.types.ts`** — dodano `inquiry_form_config: InquiryFormConfig | null` do experiences Row/Insert/Update
- **`src/lib/mock-data.ts`** — dodano `inquiry_form_config: null` do BASE_EXPERIENCE_FIELDS
- **`src/app/dashboard/trips/[id]/edit/page.tsx`** — `InquiryFormConfigEditor` poniżej ExperienceForm, oddzielone `borderTop: 2px`; przekazuje `exp.inquiry_form_config`
- **`src/app/trips/[id]/inquire/page.tsx`** — fetch `inquiry_form_config` z experiences query; przekazuje jako `formConfig` prop
- **`src/app/trips/[id]/inquire/InquireForm.tsx`**:
  - Nowy prop: `formConfig?: Partial<InquiryFormConfig> | null`
  - `cfg = resolveFormConfig(rawConfig)` na początku
  - `isRequired(key)` / `isVisible(key)` helper functions
  - Każdy konfigurowalny field wrappowany w `isVisible(key) && (...)`
  - Labels z `{isRequired(key) && ' *'}` dla wymaganego asterixu
  - Config-driven validation w `handleSubmit` — sprawdza wymagane pola przed submitem
  - `niceToHaveKeys` — "Nice to have" sekcja auto-otwiera się gdy ANY z tych pól jest `required`

#### Pola zawsze wymagane (nie konfigurowalne)
- dates / preferred period
- group size
- target species

#### Pola konfigurowalne (domyślna konfiguracja)
| Pole | Default |
|------|---------|
| tripType | required |
| numDays | optional |
| groupComposition | optional |
| experienceLevel | required |
| gear | required |
| accommodation | required |
| transport | optional |
| boatPreference | optional |
| dietary | optional |
| stayingAt | optional |
| occasions | optional |
| photography | optional |
| regionExperience | optional |
| budget | optional |
| notes | optional |

#### Wymagana akcja — migracja DB
```bash
# W Supabase Dashboard SQL Editor lub CLI:
supabase db push
# Lub wklej: supabase/migrations/20260320150000_experiences_inquiry_form_config.sql
```

### Sesja 12 — Inquiry form: tab-based UX rewrite

#### InquireForm.tsx — kompletny rewrite na 4-tabową nawigację
- **TabBar** component — segmented control style: szare tło kontenera, aktywna zakładka = białe tło + shadow
- **4 zakładki**: Trip (kalendarz) | Group (ludzie) | Needs (suwaki) | Extras (dokument)
- **Ikony SVG** inline: `IconCalendar`, `IconPeople`, `IconSliders`, `IconNotes` — minimalne, 15px
- **Error dots** (czerwone •) per zakładce po błędnym submicie — auto-navigate do pierwszej z błędem
- **Filled dots** (zielone •) per zakładce gdy tab ma wypełnione dane
- **TabHeading** — tytuł + podtytuł na górze każdej zakładki
- **Content card** min-height 300px — zapobiega layout jumpowi przy zmianie zakładki

#### Tab content:
- **Trip**: trip type chips + days stepper (multi-day only) + month grid / specific dates
- **Group**: group size stepper + beginners/children checkboxes + species pills + experience level
- **Needs**: gear / accommodation / transport / boat / dietary; "Nothing to fill here" empty state gdy wszystkie hidden
- **Extras**: occasions pills + photography + stayingAt + regionExperience + budget min/max + notes

#### Error UX:
- `errorTabs: Partial<Record<TabKey, boolean>>` — obliczane na submit
- Auto-navigate do pierwszego errored tab
- Content card border zmienia kolor na reddish gdy aktywna zakładka ma błąd

### Sesja 15 — Experience form: tab-based navigation (show/hide sections)

#### Cel
Formularz tworzenia/edycji tripu podzielony na 5 zakładek — taki sam wzorzec jak InquireForm (ankieterski), nie sticky scroll nav.

#### Zmiany w `src/components/trips/experience-form.tsx`
1. **Usunięto** `useEffect`, `useRef` z importu React
2. **Usunięto** `activeSection` state, `navRef`, oba scroll useEffects, sticky nav IIFE
3. **`SectionCard`** — `data-section` i `scroll-mt-20` usunięte; zachowano `id` prop
4. **`FormTabKey`** type + **`FORM_TABS`** const — dodane przed komponentem:
   ```ts
   type FormTabKey = 'info' | 'pricing' | 'location' | 'content' | 'media'
   const FORM_TABS = [
     { key: 'info',     label: 'Info',     next: 'pricing'  },
     { key: 'pricing',  label: 'Pricing',  next: 'location' },
     { key: 'location', label: 'Location', next: 'content'  },
     { key: 'content',  label: 'Content',  next: 'media'    },
     { key: 'media',    label: 'Media',    next: null        },
   ]
   ```
5. **Tab state** — `const [activeTab, setActiveTab] = useState<FormTabKey>('info')`
6. **Tab nav computed vars** — przed `return`:
   ```ts
   const currentTabDef = FORM_TABS.find(t => t.key === activeTab)!
   const prevTabKey    = FORM_TABS.slice().reverse().find(t => t.next === activeTab)?.key ?? null
   const isLastFormTab = currentTabDef.next == null
   ```
7. **Tab bar** (segmented control) — identyczny styl jak InquireForm: szare tło kontenera, aktywna zakładka = białe tło + shadow; klikowalne przez użytkownika
8. **Tab content** — każda zakładka otwiera `{activeTab === '...' && (<>` i zamyka `</>)}`
   - **Info**: Booking Flow + Basic Info + Fishing Details
   - **Pricing**: Pricing & Logistics (hidden for icelandic) + nota "Price on request" gdy icelandic
   - **Location**: Location
   - **Content**: Trip Plan + Trip Details (optional)
   - **Media**: Hero Background + Photos + Settings (publish toggle)
9. **Footer nav** (zamiast standalone submit button):
   - `← Back` (muted) gdy `prevTabKey != null`; `<span />` spacer gdy pierwsza zakładka
   - `Continue →` (dark blue) gdy nie ostatnia zakładka
   - Submit button (salmon) gdy ostatnia zakładka (`isLastFormTab`)
10. `pnpm typecheck` → **0 błędów**

#### UX
- Aktywna zakładka = `white` background + `boxShadow`
- Nieaktywna = `rgba(10,46,77,0.05)` tło kontenera + muted color
- Pricing tab pokazuje zrozumiały komunikat gdy tryb icelandic
- Submit pozostaje `type="submit"` — walidacja i `handleSubmit` bez zmian

### Sesja 14 — Guide-side inquiry management: tabs + navigation

#### Nowe pliki
- **`src/components/dashboard/navigation-shortcuts.tsx`** — invisible Client Component; binds ← → arrow keys to prev/next inquiry navigation; skips when focus is inside input/textarea/select
- **`src/components/dashboard/inquiry-detail-tabs.tsx`** — Client Component `InquiryDetailTabs`:
  - 3 tabs: **Request** (always), **Logistics** (hidden if all empty), **Context** (hidden if all empty)
  - Tab bar: segmented control (same style as angler InquireForm)
  - Accepts all pre-computed string props from Server Component → purely presentational
  - Exports `InquiryDetailTabsProps` type

#### Zaktualizowane pliki
- **`src/app/dashboard/inquiries/[id]/page.tsx`** — complete rewrite:
  - Parallel Promise.all fetch: inquiry + navAssigned + navUnassigned
  - Navigation list: merge+dedup+sort → prevItem / nextItem / currentNavIdx / prevHref / nextHref
  - Top nav bar: `← All Requests` on left, `← PrevName | N/M | NextName →` on right
  - `<NavigationShortcuts>` (keyboard ← →) mounted invisibly
  - Left column: `<InquiryDetailTabs {...tabProps}>` (all values pre-computed as strings)
  - Right column: actions unchanged + offer recap (`<OfferRecap>`) moved INTO right column action card (was in left column before)
  - Removed local Section/InfoRow components (moved to inquiry-detail-tabs.tsx)
  - Keyboard hint: "← → arrow keys to jump between requests"

- **`src/app/dashboard/inquiries/page.tsx`** — updated:
  - Accepts `searchParams: Promise<{ status?: string }>`
  - `FILTER_TABS` const: All | Needs reply | Offer sent | Confirmed | Declined
  - Counts per tab computed from full `all` array
  - URL-based filter: `/dashboard/inquiries?status=new` etc.
  - Active tab highlighted (white bg + shadow), others muted
  - Empty state updated with "Show all requests →" when filter active
  - Footer count row: "N requests · showing 'Filter' filter"
  - Blue dot on rows where status = inquiry/reviewing (needs action)
  - `pnpm typecheck` → **0 błędów**

### Sesja 13 — Submit only on last tab (wizard flow)

#### Cel
"Send request" tylko na ostatniej zakładce (Extras) — wymusza przejście przez wszystkie kroki.

#### Zmiany w `InquireForm.tsx`
1. **`validateCurrentTab()`** — per-tab walidacja (trips: daty/miesiące; group: species; needs: required fields per config; extras: always null)
2. **`handleContinue()`** — wywołuje `validateCurrentTab()`, markuje tab jako errored, lub przechodzi dalej
3. **`prevTab`** — `[...TABS].reverse().find(t => t.next === activeTab)?.key ?? null`
4. **Usunięto** stary "Next →" shortcut wewnątrz content card
5. **Navigation footer** zastąpił standalone submit button:
   - Tab 1 (Trip): tylko `Continue →` (dark blue, full width)
   - Taby 2–3 (Group, Needs): `← Back` (muted) + `Continue →` (dark blue)
   - Tab 4 (Extras): `← Back` (muted) + `Send request` (salmon, `type="submit"`)
6. `pnpm typecheck` → **0 błędów**

### Sesja 16 — Experience form reorganizacja zakładek + InquireForm: DateRangePicker

#### Experience form — zmiana kolejności zakładek
- Zakładka **Pricing** jest teraz PIERWSZA (`next: 'info'`), initial state = `'pricing'`
- **Pricing tab** zawiera: Booking Flow + Pricing & Logistics (lub notę "Price on request" gdy icelandic)
- **Info tab** zawiera: Basic Info + Fishing Details
- `FORM_TABS = [pricing, info, location, content, media]`

#### InquiryFormConfigEditor — slot pattern
- `ExperienceForm` props: dodano `inquiryFormConfigSlot?: React.ReactNode`
- Editor renderuje się **poza** `<form>` (zapobiega interference ze submit formularza)
- Return wrapped w `<>...</>` fragment; slot renderowany po `</form>` warunkowo:
  ```tsx
  {activeTab === 'pricing' && (bookingType === 'icelandic' || bookingType === 'both') && inquiryFormConfigSlot}
  ```
- `src/app/dashboard/trips/[id]/edit/page.tsx` — przekazuje `<InquiryFormConfigEditor>` jako `inquiryFormConfigSlot` prop

#### Usunięto Special Occasion
- `InquireForm.tsx` — usunięto: `OCCASION_OPTIONS`, `occasions` state, `toggleOccasion`, validation, submit payload, JSX
- `inquiries.ts` — usunięto `occasions` z Zod schema
- `inquiry-form-config.ts` — usunięto `occasions` z type, defaults, FIELD_GROUPS
- `inquiry-detail-tabs.tsx` — usunięto `occasionsValue` prop + rendering
- `dashboard/inquiries/[id]/page.tsx` — usunięto `occasionsValue` z tabProps

#### InquireForm — DateRangePicker (zastąpienie miesiących + date inputs)
**Cel**: zastąpić: (1) grid 18 miesięcy + (2) `<input type="date">` pola — jednym inline kalendarzem.

**Usunięto z InquireForm.tsx:**
- `getNextMonths()` helper
- `computeDatesFromMonths()` helper
- `AVAILABLE_MONTHS` const
- `useSpecificDates` state + `setUseSpecificDates`
- `selectedMonths` state + `setSelectedMonths`
- `toggleMonth()` function
- Toggle button "I have exact dates" / "I'm flexible on dates"
- Grid miesięcy JSX (18 pilek)

**Dodano `DateRangePicker` component** (przed `InquireForm`):
- Props: `from: string, to: string, onChange: (f,t) => void, disabled?: boolean`
- State wewnętrzny: `viewYear`, `viewMonth` (0-indexed), `hovered`
- **Click logic**: pierwsze kliknięcie = start (czyści to); drugie = end; jeśli kliknięty < from → swap
- **Hover preview**: po wybraniu from, hover pokazuje forward-only range (effectiveEnd)
- **Month navigation**: ‹ › przyciski, wraparound przez rok
- **Summary bar** (from/to chips + × clear) — zawsze widoczna nad kalendarzem
- **Day cells**: Mon-first grid (offset = (firstDow + 6) % 7); isPast = `< todayStr`; past dni = opacity 0.35, disabled
- **Highlights**: `isStart/isEnd` → ciemny background (#0A2E4D) + białe cyfry; `inRange` → `rgba(10,46,77,0.09)`; `isPreview` (hover forward) → `rgba(10,46,77,0.22)`; `isToday` → border
- **Hint text**: "Click to select your start date" → "Now click your end date" → "N days selected"
- **Day count**: `Math.round((to - from) / 86400000) + 1`

**Zaktualizowano w InquireForm:**
- `filledTabs.trip` → `!!specificFrom && !!specificTo`
- `validateCurrentTab 'trip'` → po prostu sprawdza oba from/to
- `handleSubmit` dates → bezpośrednio `datesFrom = specificFrom, datesTo = specificTo`
- `preferences` payload → usunięto `flexibleDates` i `preferredMonths`
- JSX "Preferred period" → prosty label + `<DateRangePicker from to onChange disabled />`

`pnpm typecheck` → **0 błędów**

### Sesja 17 — Guide Inquiry UX fix + Weekly Schedule feature

#### Inquiry detail page (`/dashboard/inquiries/[id]`) — right column redesign
- **Removed**: Generic "Actions" header
- **Added**: "What they need" summary block at top (always shown when canSendOffer or offer_sent)
  - Shows: dates+tripDays, group, target species (max 3 + overflow count), duration type
  - Each row: inline SVG icon (calendar, people, fish, clock) + value
  - Separated from form by `borderBottom: '1px solid rgba(10,46,77,0.08)'`
- **Added**: "Your offer" section label above GuideOfferForm
- **Changed**: offer_sent banner color: purple → salmon/amber (rgba(230,126,80,0.07))
- **GuideOfferForm**: removed "Send an Offer" heading; improved success state (green box + subtitle)

#### Weekly Schedule feature — full implementation
**Use case**: Guide who guides only on weekends sets Mon–Fri blocked for entire summer. Pattern repeats every week within the period.

**Files created:**
- `supabase/migrations/20260320160000_add_guide_weekly_schedules.sql` — new table with RLS
- `src/actions/weekly-schedules.ts` — `createWeeklySchedule()`, `deleteWeeklySchedule()`, export `WeeklySchedule` type

**Files modified:**
- `src/lib/supabase/database.types.ts` — added `guide_weekly_schedules` table type (between guide_calendars and guide_images)
- `src/app/dashboard/calendar/page.tsx` — fetches weekly schedules + passes as `weeklySchedules` prop to CalendarGrid
- `src/components/dashboard/calendar-grid.tsx`:
  - New import: `createWeeklySchedule`, `deleteWeeklySchedule`, `WeeklySchedule` type
  - New prop: `weeklySchedules?: WeeklySchedule[]` (default `[]`)
  - New state: `showScheduleModal`, `scheduleFrom`, `scheduleTo`, `scheduleWeekdays (Set<number>)`, `scheduleLabel`, `scheduleError`, `isSubmittingSchedule`, `deletingScheduleId`
  - New ref: `scheduleModalRef`
  - Day cell: computes `isScheduleBlocked` via `(jsUTCDay + 6) % 7` → check against all schedules
  - Background: `rgba(99,102,241,0.06)` for schedule-blocked (indigo/purple, lighter than manual blocks)
  - New chip: "⏱ Sched" in indigo (`#4F46E5`) when schedule-blocked AND not manually blocked
  - Block▾ dropdown: new "Weekly schedule" item (indigo color, clock SVG, badge count if schedules exist)
  - New modal: period picker + weekday toggles (Mon–Sun) + quick presets (Mon–Fri / Sat–Sun) + optional label + list of existing schedules with delete
  - Legend: added "Schedule · recurring weekly pattern" entry

**Weekday encoding**: `0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun` (ISO weekday - 1)

**Visual hierarchy (day cell backgrounds):**
1. Selected (multi-pick): salmon 0.13
2. Fully blocked (manual): salmon 0.08
3. Partially blocked: salmon 0.04
4. Schedule blocked: indigo 0.06
5. Normal: #FDFAF7

**Wymagana akcja — migracja DB:**
```sql
-- wklej: supabase/migrations/20260320160000_add_guide_weekly_schedules.sql
```

### Sesja 19 — Inquiry form: multi-period picker + Guide offer form: date picker + map

#### Angler inquiry form — MultiPeriodPicker (zamiana DateRangePicker)
- **`src/app/trips/[id]/inquire/InquireForm.tsx`** — kompletny rewrite zakładki Trip:
  - Dodano typy: `Period = { from: string; to: string }`, `BlockedRange`, `DayState`
  - Nowe propsy: `availabilityConfig?: AvailConfigRow | null`, `blockedDates?: BlockedRange[]`
  - Zastąpiono `DateRangePicker` przez `MultiPeriodPicker`:
    - Tryby: "Individual days" (single click) / "Date range" (click start → end)
    - Blocked dates: widoczne (strikethrough/red) ale NIE klikalne
    - Multi-period: każda selekcja dodaje się do `periods: Period[]` array
    - Chips z × do usuwania; counter "N periods · M days"; "Clear all"
  - State: `specificFrom/specificTo` → `periods: Period[]`
  - Submit: `datesFrom = earliest from`, `datesTo = latest to`, `preferences.allDatePeriods = periods` (gdy >1)
- **`src/actions/inquiries.ts`** — dodano `allDatePeriods: z.array(z.object({ from, to })).optional()` do preferences schema
- **`src/app/trips/[id]/inquire/page.tsx`** — pobiera `experience_availability_config` + `experience_blocked_dates`, przekazuje do InquireForm

#### Trip slug page — AvailabilityPreviewCalendar (read-only)
- **`src/components/trips/availability-preview-calendar.tsx`** — NEW:
  - Read-only kalendarz: available (zielona kropka), blocked (strikethrough + czerwony), booked, unavailable
  - Nawigacja miesiącami (canPrev/canNext)
  - Legenda + CTA footer "Preview only — pick your exact dates in the next step"
  - Tylko dla `icelandic` i `both` booking types
- **`src/app/trips/[id]/page.tsx`** — dodano `<AvailabilityPreviewCalendar>` przed `<CancellationPolicyBanner>`

#### DB migration — offer fields
- **`supabase/migrations/20260320180000_add_offer_meeting_fields.sql`** — NEW:
  - `ALTER TABLE trip_inquiries ADD COLUMN offer_date_from date, offer_date_to date, offer_meeting_lat float8, offer_meeting_lng float8`
- **`src/lib/supabase/database.types.ts`** — dodano 4 nowe pola do `trip_inquiries` Row/Insert/Update

#### sendOfferByGuide action — nowe parametry
- **`src/actions/inquiries.ts`** — `sendOfferByGuide()`:
  - Nowe pola: `offerDateFrom?`, `offerDateTo?`, `offerMeetingLat?`, `offerMeetingLng?`
  - DB update: `offer_date_from`, `offer_date_to`, `offer_meeting_lat`, `offer_meeting_lng`

#### GuideOfferForm — kompletny rewrite
- **`src/components/dashboard/guide-offer-form.tsx`** — rewritten:
  - Nowe propsy: `anglerDatesFrom, anglerDatesTo, anglerAllPeriods?, guideWeeklySchedules?`
  - Export: `GuideOfferFormProps` (named)
  - **Sekcja 1**: Angler's dates — read-only chips (blue, multi-period aware)
  - **Sekcja 2**: `OfferDatePicker` — wewnętrzny komponent kalendarza:
    - Pokazuje daty anglera (niebieski tint: `angler_period` / `angler_window`)
    - Pokazuje blocked weekdays przewodnika (`guide_blocked` → strikethrough/red, clickable z warningiem)
    - Przewodnik wybiera confirmed dates (pomarańczowe: half-gradient bar + orange circle)
    - Legenda 3-elementowa
    - Start view = miesiąc daty anglera (min: today)
    - Click 1 = start; click 2 = end (normalize); click 3 = reset
    - Hover preview range gdy pending
  - **Sekcja 3**: River/location (text input)
  - **Sekcja 4**: Meeting point — toggle "Pin on map →" / "Hide map":
    - `dynamic(() => import('@/components/trips/location-picker-map'), { ssr: false })`
    - Gdy pin ustawiony + mapa ukryta: pokazuje coords chip z × remove
  - **Sekcja 5**: Total price (number input)
  - **Sekcja 6**: Offer details (textarea)
  - Submit przekazuje wszystkie nowe pola do `sendOfferByGuide`

#### Inquiry detail page — zmiany
- **`src/app/dashboard/inquiries/[id]/page.tsx`**:
  - `Promise.all` + `guide_weekly_schedules` query (period_from, period_to, blocked_weekdays)
  - `prefs` type rozszerzony o `allDatePeriods?: { from: string; to: string }[]`
  - `GuideOfferForm` dostaje: `anglerDatesFrom`, `anglerDatesTo`, `anglerAllPeriods`, `guideWeeklySchedules`
  - `OfferRecap` rozszerzony o: `offer_date_from`, `offer_date_to`, `offer_meeting_lat`, `offer_meeting_lng`
    - Confirmed dates row
    - Meeting point row z Google Maps link (lat,lng ↗)
    - Dodana sekcja "Your Offer" header

#### Wymagana akcja — migracja DB
```sql
-- wklej: supabase/migrations/20260320180000_add_offer_meeting_fields.sql
```

### Sesja 18 — Calendar Disabled feature

#### Cel
Przewodnicy, którzy mają tylko `icelandic` listings (lub brak listingów) mogą wyłączyć swój kalendarz. Efekt: wszystkie strony publiczne `/trips/[id]` pokazują przycisk "Request this trip" zamiast date pickera.

#### Nowe pliki
- `supabase/migrations/20260320170000_add_calendar_disabled.sql` — `ALTER TABLE guides ADD COLUMN calendar_disabled boolean NOT NULL DEFAULT false`
- `src/components/dashboard/calendar-disabled-toggle.tsx` — Client Component; optymistyczny toggle; indigo active state; calls `toggleCalendarDisabled()`

#### Zmodyfikowane pliki
- `src/lib/supabase/database.types.ts` — dodano `calendar_disabled: boolean` do guides Row/Insert/Update
- `src/types/index.ts` — dodano `calendar_disabled` do `ExperienceWithGuide.guide` Pick
- `src/lib/supabase/queries.ts` — dodano `calendar_disabled` do `EXP_SELECT` guide fields
- `src/actions/calendar.ts` — dodano `toggleCalendarDisabled(disabled: boolean)` server action
- `src/lib/mock-data.ts` — dodano `calendar_disabled: false` do wszystkich 3 mock guides
- `src/app/dashboard/calendar/page.tsx`:
  - Guide query: `select('id, full_name, calendar_disabled')`
  - Experiences query: `select('id, title, published, booking_type')`
  - `showCalendarToggle = !hasClassicListing` (guide bez 'classic'/'both' listings)
  - Toggle card UI ponad two-column layout gdy `showCalendarToggle`
- `src/app/trips/[id]/page.tsx`:
  - Lokalny `EXP_SELECT` rozszerzony o `languages, calendar_disabled` w guide
  - `BookingWidget` i `MobileBookingBar` dostają `calendarDisabled={exp.guide.calendar_disabled ?? false}`
  - `AvailabilityPreviewCalendar` pokazuje się też gdy `calendar_disabled=true`
- `src/components/trips/booking-widget.tsx`:
  - Nowy prop `calendarDisabled?: boolean` (default `false`)
  - `effectiveType = calendarDisabled ? 'icelandic' : ...` (zawsze wygrywa)
  - `MobileBookingBar`: wczesny return z inquiry bar gdy `calendarDisabled || bookingType === 'icelandic'`

#### Logika eligibility
- Toggle widoczny gdy: `allExperiences.every(e => e.booking_type === 'icelandic') || allExperiences.length === 0`
- Przewodnicy z jakimkolwiek `classic` lub `both` listing → toggle ukryty (już mają działający kalendarz)

#### Wymagana akcja — migracja DB
```sql
-- wklej: supabase/migrations/20260320170000_add_calendar_disabled.sql
```

## Stan typechecku
`pnpm typecheck` → 0 błędów (sesja 18).

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
