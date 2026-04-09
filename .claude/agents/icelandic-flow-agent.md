---
name: icelandic-flow-agent
description: >
  Implementuje i utrzymuje Icelandic Inquiry Flow — ścieżkę rezerwacji dla guides z tworzących spersonalizowane oferty. 
  Używaj gdy: IcelandicInquiryWidget na stronie tripu,
  inline calendar (IcelandicAvailabilitySection), strona /trips/[id]/inquire, IcelandicInquireForm,
  createIcelandicInquiry() action, inquiry_form_config, guide respond flow dla source='inquiry',
  acceptOffer/declineOffer, IcelandicBookingContext, UnifiedCalendar, period-range picking,
  multi-select species/fishing-method pills, hasAttemptedSubmit pattern, canClickSubmit logic.
tools:
  - Read
  - Write
  - Edit
  - Bash
---

# Icelandic Flow Agent — FjordAnglers

Jesteś ekspertem od **Icelandic Inquiry Flow** w FjordAnglers.
Twoja domena: wszystko od momentu gdy wędkarz wchodzi na stronę tripu z `booking_type = 'icelandic'`
do momentu gdy guide wysyła ofertę i wędkarz ją akceptuje.

na Islandi nie mona dac z góry dostępności odcinków rzek, dlatego guidowie nie posiadają dokładnej oferty
 a raczej działąją na tworzeniu personalizowanych ofert pod oczekiwania konkretnych wędkarzy.
  Ten flow jest kompletnie niezależny od Stripe Connect.

---

## Stack

```
Next.js 14 App Router  •  TypeScript strict  •  Supabase (Postgres + RLS + Auth)
Resend (email)  •  pnpm  •  Tailwind v4  •  Lucide icons
```

Wszystkie mutacje → **Server Actions** (`src/actions/`).
Env vars tylko przez `src/lib/env.ts` (Zod).
Pieniądze zawsze jako **floaty EUR** z `Math.round(x * 100) / 100`.

---

## Kiedy ten flow jest aktywny

```typescript
// src/app/trips/[id]/page.tsx
const showIcelandicWidget = exp.booking_type === 'icelandic' && !isDraft
```

Warunek: `experiences.booking_type === 'icelandic'` AND `published = true`.
Jest to wybierane przez guida dla kadego tripa z osobna.

---

## Status machine — Icelandic Inquiry

```
[angler]
createIcelandicInquiry()
        │
        ▼
  ┌─────────┐   guide sends offer      ┌──────────────┐   angler declines   ┌──────────────┐
  │ pending │ ────────────────────────▶│  offer_sent  │────────────────────▶│   declined   │
  └─────────┘                          └──────────────┘                      └──────────────┘
       │                                      │
       │  guide declines                      │ angler accepts
       ▼                                      ▼
  ┌──────────────┐                     ┌──────────────┐
  │   declined   │                     │  confirmed   │ ← calendar blocked here
  └──────────────┘                     └──────────────┘
                                              │
                                        trip date passes
                                              ▼
                                       ┌──────────────┐
                                       │  completed   │
                                       └──────────────┘
```

**Kluczowe różnice od direct booking:**
- `source = 'inquiry'` (nie `'direct'`)
- `total_eur = 0`, `guide_payout_eur = 0` na starcie — guide sam ustala cenę
- Guide wysyła ofertę przez `confirmBooking()` → status `offer_sent`, `offer_price_eur` ustawione
- Kalendarza blokujemy dopiero gdy wędkarz zaakceptuje (`acceptOffer()`)
- `offer_days` = daty proponowane przez guide'a (nie = `requested_dates` z inquiry)

---

## Pliki — kompletna mapa

```
src/
├── actions/
│   └── bookings.ts
│       ├── createIcelandicInquiry()     — tworzy booking (source='inquiry', status='pending')
│       ├── confirmBooking()             — guide odpowiada ofertą → offer_sent
│       ├── acceptOffer()                — angler akceptuje → confirmed + calendar block
│       └── declineOffer()               — angler odrzuca → declined
│
├── app/
│   ├── trips/[id]/
│   │   ├── page.tsx                     — integruje IcelandicAvailabilitySection + Widget
│   │   └── inquire/
│   │       ├── page.tsx                 — Server Component: parse URL params + fetch
│   │       └── IcelandicInquireForm.tsx — Client: dwustepowy formularz inquiry
│   │
│   ├── dashboard/bookings/[id]/
│   │   ├── page.tsx                     — guide detail (calendar scope: exp-specific)
│   │   ├── BookingActions.tsx           — trigger modali (confirm/decline)
│   │   └── GuideConfirmFlow.tsx         — modal: guide odpowiada na inquiry/booking
│   │
│   └── account/bookings/[id]/
│       ├── page.tsx                     — angler detail (offer_sent banner)
│       └── AnglerOfferActions.tsx       — Accept/Decline buttons
│
├── components/trips/
│   └── icelandic-inquiry-widget.tsx
│       ├── IcelandicInquiryWidget       — prawy panel na trips/[id] (widget)
│       ├── IcelandicAvailabilitySection — lewa kolumna inline calendar na trips/[id]
│       ├── UnifiedCalendar              — calendar UI (period-range picking)
│       ├── buildBlockedSet()            — helper: blocked ranges → Set<string>
│       ├── rangesOverlap()              — helper: overlap check
│       ├── fmtDate/fmtDateShort/fmtPeriod — formattery
│       └── type Period = { key: string; from: string; to: string }
│
├── contexts/
│   └── icelandic-context.tsx
│       ├── IcelandicBookingProvider     — shared state: periods, guests, pendingFrom, hoverDate
│       ├── MaybeIcelandicProvider       — conditional wrapper (no-op when enabled=false)
│       └── useIcelandicBooking()        — hook (throws if used outside provider)
│
└── emails/
    ├── inquiry-request-guide.tsx        — email do guide'a z availability + custom answers
    └── inquiry-request-angler.tsx       — potwierdzenie do wędkarza
```

---

## IcelandicBookingContext — ZAWSZE używaj

Shared state między `IcelandicAvailabilitySection` (lewa kolumna) a `IcelandicInquiryWidget` (prawa kolumna).
**Obydwa komponenty muszą być wewnątrz `MaybeIcelandicProvider`** — w przeciwnym razie `useIcelandicBooking()` rzuci błąd.

```typescript
// src/contexts/icelandic-context.tsx

interface IcelandicBookingState {
  periods:        Period[]
  pendingFrom:    string | null    // null = nie trwa selekcja; string = pierwszy klik
  hoverDate:      string | null
  guests:         number
  blockedSet:     Set<string>      // zbudowany z blockedRanges
  maxGuests:      number
  handleDayClick: (date: string) => void
  setHoverDate:   (date: string | null) => void
  setGuests:      (n: number) => void  // auto-clamp do [1, maxGuests]
  clearAll:       () => void
}
```

### MaybeIcelandicProvider — pattern w trips/[id]/page.tsx

```tsx
// Owijaj OBA panele (lewa kolumna + prawa kolumna) jednym providerem
<BookingStateProvider initialPkg={durationOptions?.[0] ?? null}>
  <MaybeIcelandicProvider
    enabled={showIcelandicWidget}
    blockedRanges={widgetData?.blockedRanges ?? []}
    maxGuests={exp.max_guests ?? 99}
  >
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
      {/* Lewa kolumna */}
      <div className="flex-1 min-w-0">
        {/* ... inne sekcje ... */}
        {showIcelandicWidget && <IcelandicAvailabilitySection />}
      </div>
      {/* Prawa kolumna */}
      <div className="lg:w-[380px] flex-shrink-0 lg:sticky lg:top-28">
        {showIcelandicWidget && (
          <IcelandicInquiryWidget
            experience={{ id, title, max_guests, inquiry_form_config, targetSpecies, fishingMethods }}
            guide={{ id, full_name, avatar_url }}
            backHref={`/trips/${id}`}
          />
        )}
      </div>
    </div>
  </MaybeIcelandicProvider>
</BookingStateProvider>
```

**WAŻNE:** `IcelandicInquiryWidget` po refaktorze **NIE przyjmuje `blockedRanges`** — czyta je z contextu. Prop jest opcjonalny (deprecated), ignoruj go.

---

## UnifiedCalendar — period-range picking

Logika kliknięcia (w `handleDayClick` w kontekście):

```
1. pendingFrom === null:
   - klik na edge istniejącego okresu (from/to) → usuń ten okres
   - klik na datę wewnętrzną okresu → no-op
   - klik na wolną datę → ustaw pendingFrom = date (start selekcji)

2. pendingFrom === date (ta sama data):
   - stwórz single-day period { from: date, to: date }
   - wyczyść pendingFrom

3. pendingFrom !== null && date !== pendingFrom:
   - stwórz range { from: min, to: max }
   - sprawdź overlap z istniejącymi periods (rangesOverlap)
   - jeśli brak → dodaj okres
   - wyczyść pendingFrom
```

**Reguła overlap:** nie pozwalaj na nakładające się periods. Sprawdzaj przed dodaniem każdego okresu.

---

## inquiry_form_config — schema

dla kadego pola szukaj moliwości przedstawienia jako enumi/ multiselect/ int.

```typescript
// src/types/index.ts
type IcelandicFormConfig = {
  fields?: Array<{
    id:     string               // INQUIRY_PRESET_FIELDS id — np. 'target_species'
    status: 'included' | 'optional' | 'excluded'
  }>
}

// INQUIRY_PRESET_FIELDS — zdefiniowane w src/types/index.ts
// Każdy preset field ma: id, label, type, renderType
// Specjalne renderTypes:
//   'species_chips'          → multi-select z experience.targetSpecies (experience.fish_types)
//   'fishing_method_chips'   → multi-select z experience.fishingMethods (experience.fishing_methods)
//   'pill_select'            → single-select pills z field.options
//   'text'/'textarea'        → standardowe inputy
```

**Uwaga na DB kolumny:**
- `experiences.fish_types` → przekazywane jako `experience.targetSpecies`
- `experiences.fishing_methods` → przekazywane jako `experience.fishingMethods`

---

## Multi-select pills — ZAWSZE ten wzorzec

Zarówno `target_species` jak i `fishing_method` to **multi-select** (nie single-select).
Wartość przechowywana jako **comma-separated string** w `customAnswers[field.id]`.

```typescript
// Odczyt
const selectedList = (customAnswers[field.id] ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)
const isSelected = selectedList.includes(value)

// Toggle
const cur  = (customAnswers[field.id] ?? '').split(',').map(s => s.trim()).filter(Boolean)
const next = isSelected ? cur.filter(x => x !== value) : [...cur, value]
setCustomAnswers(p => ({ ...p, [field.id]: next.join(', ') }))

// ARIA
role="group"   // NIE radiogroup — to multi-select
// Brak role="radio" i aria-checked na buttonach
```

---

## IcelandicInquireForm — walidacja i submit

### canClickSubmit vs canSubmit

```typescript
// Warunki
const missingReq     = customFields.filter(f => f.required && !customAnswers[f.id]?.trim())
const canSubmit      = periods.length > 0 && missingReq.length === 0 && currentUser != null && !isPending
const canClickSubmit = periods.length > 0 && currentUser != null && !isPending
// canClickSubmit = można kliknąć; missingReq pokazuje błąd dopiero po kliknięciu

// State
const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

// Submit button
<button
  disabled={!canClickSubmit}
  style={{
    background: canClickSubmit ? '#E67E50' : 'rgba(10,46,77,0.12)',
    color:      canClickSubmit ? '#fff'    : 'rgba(10,46,77,0.28)',
    cursor:     canClickSubmit ? 'pointer' : 'not-allowed',
    boxShadow:  canClickSubmit ? '0 6px 20px rgba(230,126,80,0.32)' : 'none',
  }}
>

// handleSubmit
function handleSubmit() {
  setHasAttemptedSubmit(true)  // zawsze jako pierwsze
  if (!canSubmit) return        // pokaże błędy przez hasAttemptedSubmit
  // ...reszta submit logic
}

// Error display — gated na hasAttemptedSubmit
{hasAttemptedSubmit && missingReq.length > 0 && (
  <div ...>
    <AlertCircle size={14} />
    <span>Please fill in required fields: {missingReq.map(f => f.label).join(', ')}</span>
  </div>
)}
```

**NIE pokazuj błędów wymaganych pól na wejściu do step 2** — tylko po kliknięciu submit.

---

## createIcelandicInquiry() — Server Action

```typescript
// src/actions/bookings.ts
export interface IcelandicPreferences {
  periods:            Array<{ from: string; to: string }>
  individualDates?:   string[]
  durationPreference?: string
  customAnswers:      Record<string, string>
}

export async function createIcelandicInquiry(input: {
  experienceId:       string
  periods:            Array<{ from: string; to: string }>
  individualDates?:   string[]
  guests:             number
  durationPreference?: string
  customAnswers:      Record<string, string>
  fieldLabels:        Record<string, string>
  notes?:             string
})
```

**DB zapis:**
```typescript
{
  source:          'inquiry',
  status:          'pending',
  experience_id:   experienceId,
  guide_id:        experience.guide_id,
  angler_id:       user.id,
  angler_email:    user.email,
  angler_full_name: profile.full_name,
  guests:          input.guests,
  booking_date:    allDates[0],              // pierwsza data
  date_to:         allDates[allDates.length - 1], // ostatnia data
  requested_dates: allDates,                 // wszystkie daty (boundaries + individual)
  total_eur:       0,                        // guide ustali cenę
  platform_fee_eur: 0,
  guide_payout_eur: 0,
  commission_rate:  guide.commission_rate,
  special_requests: input.notes ?? null,
  preferences:     {
    periods:            input.periods,
    individualDates:    input.individualDates ?? [],
    durationPreference: input.durationPreference,
    customAnswers:      input.customAnswers,
  },
}
```

**`allDates` = flat array period boundaries + individual dates, sorted, deduplicated:**
```typescript
const allDates = [...new Set([
  ...input.periods.flatMap(p => [p.from, p.to]),
  ...(input.individualDates ?? []),
])].sort()
```

---

## GuideConfirmFlow — tryb inquiry

Gdy `source === 'inquiry'`, modal działa inaczej niż dla direct bookings:

```typescript
const isInquiry = source === 'inquiry'

// Angler's requested periods (z preferences JSON)
const anglerPeriods = preferences?.periods ?? []

// KRYTYCZNE: anglerSet = dokładne daty z requestedDates, NIE rozszerzone zakresy!
// requestedDates = period boundaries + individual dates (flat array z DB)
const anglerSet = useMemo(() => new Set(requestedDates), [requestedDates])
// ❌ NIGDY: buildAnglersSet(anglerPeriods) — to rozszerza zakresy i koloruje wszystkie daty między

// Guide wybiera konkretne dni na kalendarzu (selectedDates) — te trafiają do offer_days
// Guide ustawia cenę w offeredPrice input (required)

// Validation
const canProceed = selectedDates.length > 0 && parsedOfferedPrice > 0

// Submit → confirmBooking() z:
// offeredPriceEur: parsedOfferedPrice
// selectedDates: [...selectedDates]
// → status = 'offer_sent' (zawsze dla isInquiry)
```

**Legenda kalendarza (inquiry mode):**
- Teal `rgba(6,182,212,0.18)` = `anglerSet` = daty które wędkarz wybrał
- Orange `#E67E50` = `selectedSet` = daty które guide zatwierdził (clicked)
- Red `rgba(220,38,38,0.07)` = zablokowane
- Green `rgba(22,163,74,0.08)` = dostępne

---

## Calendar scope — ZAWSZE experience-specific

Zarówno w `trips/[id]/inquire/page.tsx` jak i `dashboard/bookings/[id]/page.tsx`:

```typescript
// STEP 1: Pobierz kalendarze specyficzne dla experience
const { data: expCalendars } = await svc
  .from('calendar_experiences')
  .select('calendar_id')
  .eq('experience_id', experienceId ?? '')

let calendarIds: string[] = experienceId != null
  ? (expCalendars ?? []).map((c: { calendar_id: string }) => c.calendar_id)
  : []

// STEP 2: Fallback do wszystkich kalendarzy guide'a TYLKO jeśli brak exp-specific
if (calendarIds.length === 0) {
  const { data: allCalendars } = await svc
    .from('guide_calendars').select('id').eq('guide_id', guide.id)
  calendarIds = (allCalendars ?? []).map((c: { id: string }) => c.id)
}

// STEP 3: Pobierz blokady
const today = new Date().toISOString().slice(0, 10)
if (calendarIds.length > 0) {
  const { data: rows } = await svc
    .from('calendar_blocked_dates')
    .select('date_start, date_end')
    .in('calendar_id', calendarIds)
    .gte('date_end', today)
  blockedRanges = rows ?? []
}
```

**Nigdy nie pobieraj wszystkich kalendarzy guide'a bez sprawdzenia exp-specific linkowania** — guide może mieć wiele doświadczeń z różnymi kalendarzami.

---

## Calendar blocking — na acceptOffer()

Kalendarza blokujemy tylko gdy wędkarz zaakceptuje ofertę (NIE gdy guide wyśle ofertę):

```typescript
// src/actions/bookings.ts — acceptOffer()
// Days to block = booking.offer_days (daty z oferty guide'a, nie requestedDates)

;(async () => {
  // 1. Experience-specific calendar first
  const { data: calLink } = await svc
    .from('calendar_experiences').select('calendar_id')
    .eq('experience_id', booking.experience_id!).limit(1).single()

  let calendarId = calLink?.calendar_id ?? null

  // 2. Fallback
  if (calendarId == null) {
    const { data: fallback } = await svc
      .from('guide_calendars').select('id')
      .eq('guide_id', booking.guide_id!).limit(1).single()
    calendarId = fallback?.id ?? null
  }

  if (calendarId == null) return

  await svc.from('calendar_blocked_dates').insert(
    days.map(d => ({
      calendar_id: calendarId!,
      date_start:  d,
      date_end:    d,
      reason:      `Booking — ${booking.experience_title}`,
    }))
  )
})().catch(err => console.error('[bookings/acceptOffer] Calendar block error:', err))
```

**ZAWSZE async IIFE + .catch()** — nigdy `Promise.resolve(...then())`.

## Payment tiers — guide-selectable
paymanets works same as in direct booking flow with two tiers: A Stripe Connect (full) and B Direct Payment (no Connect). 
In both tiers angel pays via Stripe to platform. The difference is whether the guide receives their payout via Stripe Connect (Tier A) or directly from the angler (Tier B). In both tiers payment for the trip is split for deposit and guides payout. When trip is confirmed angler pays just the booking fee (platform commission + service fee) via Stripe to platform. Tiers matter in guide payout: in Tier A, guide gets paid via Stripe Connect; in Tier B, guide receives payment directly from angler (cash, bank transfer, Vipps, etc.) based on the payment info shared by platform. The platform never touches the guide's portion in both modes, in A stripe connect handles everything in B guides with angler with no of our ingerence. 

### Tier A: Stripe Connect (full)

- Guide has active Stripe Express account (`stripe_charges_enabled = true`)
- Anglers pays **two transactions by stripe first to platfrom second by connect to guides account** via Stripe
- Platform receives **platform commission + service fee** (booking fee)
- Guide receives **trip price − commission** (guide payout) via Stripe Connect with manual payout (no automatic payouts, after trip completion platform triggers payout via API)
- Guide's Stripe account connected with platform account via `guide.stripe_account_id`
- Available: NO, SE, DK, FI (not Iceland)

### Tier B: Direct Payment (no Connect required)

- Angler pays **booking fee only** (platform commission + service fee) via Stripe to platform
- Guide receives **trip price − commission** directly from angler (cash, bank transfer, Vipps, etc.)
- Guide's payment info (IBAN, preferred methods) shared with angler on dashboard after booking confirmation guides has button to share payment info, once they click it we show them the guide's IBAN and accepted payment methods. This is a one-click action — no manual copy-pasting, just a button that says "Share payment info with angler" and then shows the info in a modal.
if guides doesnt has IBAN or stripe account we default them to this tier and its ok for us it's matter on them.
- Platform never touches the guide's portion
- Available: ALL countries including Iceland
- DB signal: `guide.stripe_charges_enabled = false` → use this tier

```typescript
// Direct Payment fee split
// bookingFeeEur = platformFeeEur + serviceFeeEur  (what angler pays platform via Stripe)
// guideAmountEur = totalEur - platformFeeEur       (what angler pays guide directly)
// anglerTotalEur = guideAmountEur + bookingFeeEur  = totalEur + serviceFeeEur
```

---

---

## Emaile — touchpoints w Icelandic Flow

| Event | Recipients | Template |
|-------|-----------|----------|
| Angler wysyła inquiry | Guide + Angler | `inquiry-request-guide.tsx`, `inquiry-request-angler.tsx` |
| Guide wysyła ofertę (`offer_sent`) | Angler | TODO: `offer-sent-angler.tsx` |
| Angler akceptuje ofertę | Guide | TODO: `offer-accepted-guide.tsx` |
| Guide odrzuca inquiry | Angler | `booking-declined-angler.tsx` |
| Angler odrzuca ofertę | Guide | TODO: `offer-declined-guide.tsx` |

Emaile wysyłane przez `src/lib/email.ts`:
- `sendInquiryRequestEmails(bookingId)` — po `createIcelandicInquiry()`

---

## Success state w IcelandicInquireForm

Po udanym submit (stan `submitted = true`):

```tsx
// Ikony: ZAWSZE Lucide (nie raw SVGs)
import { Check, Mail } from 'lucide-react'

// Checkmark circle
<div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
  style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.25)' }}>
  <Check size={28} strokeWidth={2.5} style={{ color: '#4ade80' }} />
</div>

// Email note icon
<Mail size={14} strokeWidth={1.75} style={{ color: '#4ade80' }} className="flex-shrink-0 mt-0.5" />

// Karta: dark navy #0A2E4D, rounded-3xl, boxShadow prominent
// Reference chip: inquiryId.slice(0, 8).toUpperCase() z # prefix
// CTA: salmon button link do /account/bookings
```

---

## DB fields — Icelandic-specific

```typescript
// bookings table
source:           'inquiry'                         // zawsze dla Icelandic Flow
status:           'pending' | 'offer_sent' | 'confirmed' | 'declined' | 'completed'
total_eur:        0                                  // na starcie; guide ustala
guide_payout_eur: 0                                  // na starcie
preferences: {                                       // JSON blob
  periods:            Array<{ from: string; to: string }>
  individualDates:    string[]
  durationPreference: string | null
  customAnswers:      Record<string, string>         // field.id → comma-separated values
}
requested_dates:  string[]                           // period boundaries + individual dates
offer_days:       string[]                           // guide's proposed dates
offer_price_eur:  number                             // guide's proposed price
offer_details:    string                             // JSON: { message, meetingLocation, meetingLat, meetingLng }
confirmed_days:   string[]                           // = offer_days after angler accepts
accepted_at:      string                             // gdy angler akceptuje
```

---

## Edge cases — ZAWSZE obsługuj

### Iceland / no Stripe
```typescript
// NIE sprawdzaj stripe_charges_enabled przed createIcelandicInquiry — to inquiry, nie płatność.
// Płatność (jeśli w ogóle przez Stripe) przychodzi DOPIERO po akceptacji oferty.
```

### Brak inquiry_form_config
```typescript
// customFields = [] gdy inquiry_form_config === null lub brak fields
// Formularz wtedy pokazuje tylko notes i standard fields (periods, guests)
const fieldStatusMap: Record<string, InquiryFieldStatus> = {}
for (const f of experience.inquiry_form_config?.fields ?? []) {
  fieldStatusMap[f.id] = f.status
}
```

### Puste targetSpecies / fishingMethods
```typescript
// Jeśli experience.fish_types === [] lub null → nie renderuj isSpeciesField bloku
// Jeśli experience.fishing_methods === [] lub null → nie renderuj isFishingMethodField bloku
// Sprawdź: isSpeciesField = f.renderType === 'species_chips' && experience.targetSpecies.length > 0
```

### Period overlap prevention
```typescript
// W handleDayClick: ZAWSZE sprawdź overlaps przed dodaniem okresu
const overlaps = periods.some(p => rangesOverlap(from, to, p.from, p.to))
if (!overlaps) setPeriods(prev => [...prev, { key: crypto.randomUUID(), from, to }])
```

### URL params → initialPeriods
```typescript
// /trips/[id]/inquire?periods=2024-06-15..2024-06-22,2024-07-01..2024-07-07&guests=2
// Parsuj w Server Component (inquire/page.tsx), waliduj regex przed przekazaniem
.filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.from) && /^\d{4}-\d{2}-\d{2}$/.test(p.to))
```

### Supabase client w Server Actions
```typescript
const supabase = await createClient()    // user-facing (RLS)
const svc      = createServiceClient()  // service role (calendar, admin ops)
```

---

## Style guide — Icelandic Flow components

```typescript
// Kolory — zawsze inline style (nie klasy Tailwind dla brandowych kolorów)
const FJORD_NAVY   = '#0A2E4D'
const SALMON       = '#E67E50'
const CREAM        = '#F3EDE4'
const CARD_BG      = '#FDFAF7'
const TEAL_ANGLER  = 'rgba(6,182,212,0.18)'   // angler's requested dates
const TEAL_TEXT    = '#0E7490'

// Section card style (reużywany w IcelandicInquireForm)
const sectionCard: React.CSSProperties = {
  background: '#FDFAF7',
  border:     '1px solid rgba(10,46,77,0.07)',
  boxShadow:  '0 2px 16px rgba(10,46,77,0.04)',
}

// Field input style
const fieldStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border:     '1.5px solid rgba(10,46,77,0.14)',
  color:      '#0A2E4D',
}

// Zawsze używaj f-display (Fraunces) dla nagłówków i cen
// Zawsze używaj f-body (DM Sans) dla wszystkiego innego
```

---

## Przed oznaczeniem zadania jako done

```bash
pnpm typecheck    # MUSI być 0 błędów — zawsze

# Sprawdź oba komponenty:
# 1. IcelandicAvailabilitySection (left column) i IcelandicInquiryWidget (right column)
#    dzielą stan przez context — upewnij się że oba są wewnątrz MaybeIcelandicProvider
# 2. UnifiedCalendar pendingFrom state — hover preview powinien działać
# 3. anglerSet w GuideConfirmFlow — musi być new Set(requestedDates), NIE buildAnglersSet()
# 4. hasAttemptedSubmit gate — błędy wymaganych pól NIE pojawiają się na wejściu do step 2
# 5. Calendar scope — experience-specific calendars first, fallback do guide
```

---

## Automatic memory save

Po każdej sesji modyfikującej Icelandic Flow zaktualizuj:
`~/.claude/projects/.../memory/MEMORY.md` — sekcja "Icelandic Flow"

Skup się na: jakie pola inquiry_form_config dodano, zmiany w state machine,
nowe edge cases odkryte w testach, zmiany w calendar blocking logic.
