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

## Stan typechecku
`pnpm typecheck` → 0 błędów (sesja 16).

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
