# db-migration-agent — pamięć

## Sesja 2026-03-13 — db-migration-agent (migracje profilu)

### Migracje wykonane

| Plik | Tabela | Co robi |
|---|---|---|
| `20260309154301_add_location_coords_to_experiences.sql` | experiences | location_lat, location_lng dla map view |
| `20260313125203_add_guide_profile_columns.sql` | guides | slug, tagline, certifications (TEXT→TEXT[]), specialties, google_rating/count/url, external_reviews JSONB, cancellation_policy, boat_name/type/length/engine/capacity |
| `20260313125204_add_experience_trip_columns.sql` | experiences | slug, duration_options JSONB, group_pricing JSONB, fishing_methods TEXT[], season_from/to, meeting_point_address/lat/lng, inclusions JSONB, license_region |
| `20260314205947_add_landscape_url_to_experiences.sql` | experiences | landscape_url (hero zdjęcie krajobrazu) |

---

## Sesja 2026-03-15 — db-migration-agent (Wave 4A — Booking DB schema)

### Migracje Wave 4A

| Plik | Co robi |
|---|---|
| `20260315111628_extend_booking_status_enum.sql` | Dodaje `accepted` i `declined` do enuma `booking_status` |
| `20260315111629_add_booking_payment_columns.sql` | Dodaje do `bookings`: deposit_eur, commission_rate, stripe_checkout_id, stripe_payment_intent_id, stripe_transfer_id, duration_option, accepted_at, declined_at, declined_reason + 4 indeksy |
| `20260315111630_create_trip_inquiries.sql` | Tworzy enum `trip_inquiry_status` + tabelę `trip_inquiries` + RLS (3 policies) + trigger updated_at + 5 indeksów |

### Status bazy po Wave 4A

- Projekt: `uwxrstbplaoxfghrchcy` (Supabase Cloud)
- Wszystkie 7 migracji zaaplikowane ✅
- `pnpm supabase db push` — bez błędów (NOTICE o DROP TRIGGER IF NOT EXISTS jest OK)
- `pnpm supabase:types` — database.types.ts zregenerowany
- `pnpm typecheck` — ZERO błędów ✅

### Poprawka TypeScript po Wave 4A

- **`src/app/dashboard/bookings/page.tsx`** — `STATUS_STYLES` uzupełniony o `accepted` i `declined`:
  - `accepted`: niebieski (`rgba(59,130,246,0.1)` / `#2563EB`)
  - `declined`: ciemnoczerwony (`rgba(239,68,68,0.08)` / `#B91C1C`)

### Schema `trip_inquiries`

```
id                       UUID PK
angler_id                UUID → auth.users (nullable, anon submissions allowed)
angler_email             TEXT NOT NULL
angler_name              TEXT NOT NULL
status                   trip_inquiry_status DEFAULT 'inquiry'
dates_from / dates_to    DATE NOT NULL
target_species           TEXT[] DEFAULT '{}'
experience_level         TEXT CHECK (beginner|intermediate|expert)
group_size               INT CHECK (1–50)
preferences              JSONB DEFAULT '{}'  { budgetMin, budgetMax, accommodation, riverType, notes }
assigned_guide_id        UUID → guides (nullable)
assigned_river           TEXT
offer_price_eur          NUMERIC(10,2)
offer_details            TEXT
stripe_checkout_id       TEXT
stripe_payment_intent_id TEXT
created_at / updated_at  TIMESTAMPTZ
```

### RLS trip_inquiries

- SELECT: `angler_id = auth.uid() OR angler_email = (SELECT email FROM auth.users WHERE id = auth.uid())`
- INSERT: `WITH CHECK (true)` — każdy może złożyć zapytanie
- UPDATE: `auth.role() = 'service_role'` — tylko admin Server Actions

### Nowe kolumny bookings

- `deposit_eur NUMERIC(10,2)` — 30% kwoty do zapłaty przy checkout
- `commission_rate NUMERIC(4,3) DEFAULT 0.10` — stawka komisji zapisana przy bookingu
- `stripe_checkout_id TEXT` — id sesji checkout (correlacja webhooków)
- `stripe_payment_intent_id TEXT` — id płatności Stripe
- `stripe_transfer_id TEXT` — id przelewu do guide (Connect payout)
- `duration_option TEXT` — label wybranej opcji czasu (z duration_options JSONB)
- `accepted_at TIMESTAMPTZ` — kiedy guide zaakceptował
- `declined_at TIMESTAMPTZ` — kiedy guide odrzucił
- `declined_reason TEXT` — powód odrzucenia

### CLI Setup (bez zmian od poprzedniej sesji)

- `supabase` binarny: pnpm nie pobrał go automatycznie (brak postinstall)
- Fix: `cd node_modules/.pnpm/supabase@2.76.15/node_modules/supabase && node scripts/postinstall.js`
- `pnpm supabase link --project-ref uwxrstbplaoxfghrchcy`
- `SUPABASE_ACCESS_TOKEN` musi być w ENV

### Skrypty w package.json

```json
"supabase:types": "supabase gen types typescript --project-id uwxrstbplaoxfghrchcy > src/lib/supabase/database.types.ts",
"supabase:push": "supabase db push"
```

### Breaking changes z certifications — NADAL do naprawy

1. `src/actions/guide-apply.ts` — `certifications: string` → `string[]`
2. `src/components/guides/apply-form.tsx` — text input → tag/array input
3. `src/app/(public)/guides/[id]/page.tsx` — render array nie string

### Wave 4 status

| Wave | Status |
|------|--------|
| 4A — db-migration-agent | ✅ Done (2026-03-15) |
| 4B — booking-flow-agent | ✅ Done (2026-03-15) |
| 4C — booking-flow-agent | ✅ Done (2026-03-15) |
| 4D — booking-flow-agent (duration UX) | ✅ Done (2026-03-15) |

### Wave 4D — Duration picker UX (booking-flow-agent, 2026-03-15)

| Plik | Co robi |
|---|---|
| `src/components/experiences/duration-cards-selector.tsx` | NEW — interaktywne karty "Choose your duration" z selected ring + checkmark; dispatch + listen `fjord:duration-select` CustomEvent |
| `src/components/experiences/booking-widget.tsx` | MODIFIED — pill buttons → custom dropdown (trigger + panel); sync z kartami przez `fjord:duration-select` |
| `src/app/experiences/[id]/page.tsx` | MODIFIED — import DurationCardsSelector; ~80 linii static JSX zastąpione `<DurationCardsSelector options={durationOptions} />` |

**Sync contract (bidirektywny, bez pętli):**
- Card clicked → `{ idx, source: 'cards' }` → BookingWidget aktualizuje dropdown (ignoruje `source === 'widget'`)
- Dropdown changed → `{ idx, source: 'widget' }` → DurationCardsSelector podświetla kartę (ignoruje `source === 'cards'`)

### Wave 4B — nowe pliki (booking-flow-agent, 2026-03-15)

| Plik | Co robi |
|---|---|
| `src/actions/bookings.ts` | `createBookingCheckout` (DB + Stripe Checkout 30% deposit), `acceptBooking`, `declineBooking` |
| `src/app/book/[expId]/page.tsx` | 2-col checkout page z price breakdown + formularzem anglera |
| `src/app/book/[expId]/BookingCheckoutForm.tsx` | Client form z loading spinner |
| `src/app/book/[expId]/confirmation/page.tsx` | Success page po płatności |
| `src/app/api/stripe/webhook/route.ts` | Webhook handler: `checkout.session.completed` + `charge.refunded` |
| `src/app/account/bookings/page.tsx` | Historia rezerwacji anglera |
| `src/components/dashboard/booking-actions.tsx` | Accept/Decline buttons (Client Component) |
| `src/app/dashboard/bookings/page.tsx` | Dodana kolumna Actions + import BookingActions |

### Wave 4C — nowe pliki (booking-flow-agent, 2026-03-15)

| Plik | Co robi |
|---|---|
| `src/actions/inquiries.ts` | `submitInquiry`, `updateInquiryStatus`, `sendOffer`, `acceptOffer` |
| `src/app/plan-your-trip/page.tsx` | 2-step inquiry form (species, dates, group, preferences) |
| `src/app/admin/inquiries/page.tsx` | Admin queue z stats |
| `src/app/admin/inquiries/[id]/page.tsx` | Admin detail + akcje (mark reviewing, send offer) |
| `src/app/admin/inquiries/[id]/AdminInquiryActions.tsx` | Client component dla admin akcji |
| `src/app/account/trips/[id]/page.tsx` | Angler offer view (status timeline + offer card) |
| `src/app/account/trips/[id]/AcceptOfferButton.tsx` | Accept offer → Stripe Checkout |
| `src/components/admin/sidebar.tsx` | Dodany IconChat + link do /admin/inquiries |

---

## Sesja 2026-03-15 — db-migration-agent (location_area column)

### Migracja

| Plik | Tabela | Co robi |
|---|---|---|
| `20260315120358_add_location_area_to_experiences.sql` | experiences | Dodaje `location_area JSONB NULL` — opcjonalny GeoJSON Polygon rysowany przez guide'a; centroid trzymany w location_lat/lng |

### Zmiany w database.types.ts (ręczna aktualizacja)

Kolumna `location_area: Json | null` dodana po `location_country` w trzech blokach:
- `Row` (linia ~263): `location_area: Json | null` (required)
- `Insert` (linia ~306): `location_area?: Json | null` (optional)
- `Update` (linia ~349): `location_area?: Json | null` (optional)

### Uwaga

`pnpm supabase db push` NIE bylo uruchamiane w tej sesji — migracja czeka na ręczne zastosowanie.
