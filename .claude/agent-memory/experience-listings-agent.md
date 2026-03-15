# experience-listings-agent — pamięć

## Sesja 2026-03-15 — UX fixes, crop modal, icelandic flow, map pin, hero, filtering & both booking type

### Routing — UWAGA: nazwa katalogu

Trasy experiences zostały przemianowane przez Tymona:
- `src/app/experiences/` → **`src/app/trips/`**
- `src/components/experiences/` → **`src/components/trips/`**

Wszystkie importy używają `@/components/trips/` i `@/app/trips/`.

---

### Zmiany w tej sesji

#### 1. CropModal w image-upload.tsx

Dodano `CropModal` (Canvas API, bez zewnętrznych bibliotek) do `src/components/admin/image-upload.tsx`:
- `cropAspect?: number` prop w `ImageUploadProps`
- Crop 16:9 dla cover photo, 1:1 dla avatara
- **Strict Mode fix**: `URL.createObjectURL` przeniesiony z `useState` do `useEffect` — zapobiega podwójnemu mount z React Strict Mode
- Output: `min(srcW, 2400)px` JPEG quality 0.94
- Grid rule-of-thirds + corner brackets overlay

```tsx
// Wzorzec Strict Mode safe:
const [blobUrl, setBlobUrl] = useState('')
useEffect(() => {
  const url = URL.createObjectURL(file)
  setBlobUrl(url)
  return () => URL.revokeObjectURL(url)
}, [file])
// Guard: {blobUrl !== '' && <img ... />}
```

Formularze z crop:
- `create-guide-form.tsx` — cover `cropAspect={16/9}`, avatar `cropAspect={1}`
- `edit-guide-form.tsx` — cover `cropAspect={16/9}`, avatar `cropAspect={1}`
- `profile-edit-form.tsx` — cover `cropAspect={16/9}`, avatar `cropAspect={1}`
- `experience-form.tsx` — cover `cropAspect={16/9}`

#### 2. MultiImageUpload w experience-form.tsx

Zastąpiono 4 stałe sloty `ImageUpload` na `<MultiImageUpload max={6} />` (jak formularz guide'a).

Stan galerii: `GalleryImage[]` (zamiast `Array<string|null>`).

#### 3. Icelandic / "price on request" flow

Gdy `bookingType === 'icelandic'`:
- Walidacja formularza pomija wymaganie ceny i czasu
- `price_per_person_eur = null`, `duration_options = null`, scalary null
- DB: `price_per_person_eur ?? 0` jako sentinel (kolumna NOT NULL — migracja czeka)

**MIGRATION APPLIED** ✅: `20260315220000_make_price_nullable_for_icelandic.sql`
— `DROP NOT NULL` + `DROP CONSTRAINT experiences_price_per_person_eur_check`
— `price_per_person_eur` jest nullable w DB, kod używa `?? null` (brak sentinela).

#### 4. Map area pin lock (`src/app/trips/map-view.tsx`)

- Stan `pinnedAreaId: string | null`
- `MapClickClearer` component — `useMapEvents({ click: () => setPinnedAreaId(null) })`
- Kliknięcie pina: `L.DomEvent.stopPropagation(e.originalEvent)` + toggle `pinnedAreaId`
- `isHighlighted(id)` uwzględnia `pinnedAreaId`

#### 5. Hero margin fix (`src/app/page.tsx`)

Hero content wrapper: `pt-24` → `pt-[72px]` — dokładnie równa wysokości fixed nav `h-[72px]`.

---

### Kluczowe typy (aktualizacja)

| Pole | Zmiana |
|------|--------|
| `ExperiencePayload.price_per_person_eur` | `number` → `number | null` |
| `ExperiencePayload.duration_options` | `DurationOptionPayload[]` → `DurationOptionPayload[] | null` |
| `database.types.ts` Row/Insert/Update `price_per_person_eur` | `number` → `number | null` |
| `BookingWidgetProps.legacyPricePerPerson` | `number` → `number | null` |

---

---

### Zmiany w sesji 2026-03-15 (ciąg dalszy)

#### 6. Map pin icons (map-view.tsx)

- **Single pin**: `singlePriceIcon(price)` — biały pill, brak obramowania (plain white)
- **Area/multi pin**: `areaPriceIcon(price, highlighted)` — biały pill + orange ring border gdy highlighted
- Secondary dots (multi-spot): widoczne **tylko przy hoveru** — owinięte `isHighlighted(exp.id) &&`
- `CircleOverlay` komponent usunięty całkowicie (nie potrzebny)

#### 7. Icelandic slug page (`src/app/trips/[id]/page.tsx`)

- "Duration" ukryte w quick facts gdy `booking_type === 'icelandic'`
- Fishing methods tags zawsze widoczne (dla wszystkich typów rezerwacji)

#### 8. Booking type 'both'

**DB**: `supabase/migrations/20260315230000_add_both_booking_type.sql`
```sql
ALTER TABLE experiences DROP CONSTRAINT IF EXISTS experiences_booking_type_check;
ALTER TABLE experiences ADD CONSTRAINT experiences_booking_type_check CHECK (booking_type IN ('classic', 'icelandic', 'both'));
```
⚠️ Run manually in Supabase SQL Editor.

**booking-widget.tsx**:
- `subMode: 'book' | 'request'` state tylko dla 'both'
- `effectiveType` = `'both'` ? (subMode → classic/icelandic) : bookingType
- Two-tab banner: "Book & Pay 💳" / "Request Offer ✉️"
- MobileBookingBar: 2 side-by-side CTAs gdy 'both'

**experience-form.tsx**:
- `bookingType` state: `'classic' | 'icelandic' | 'both'`
- 3 opcje w siatce (grid-cols-3)
- 'both' shows pricing/duration form (jak classic)
- Country field: zmieniony z TextInput na `<select>` z `COUNTRIES` lib

#### 9. Map filtering bug — `filterKey` + `hasServerFilters`

**Problem**: `BoundsTracker.useEffect` ustawia viewport bounds od razu po mount Leaflet.
Przy aktywnych filtrach serwera (kraj, ryba) wyniki mogły być poza widokiem mapy → 0 kart.

**Fix** (`map-section.tsx`):
- `filterKey: string` prop — serializacja aktywnych params (bez page)
- `hasServerFilters = filterKey !== ''`
- `useViewportFilter = bounds != null && !hasServerFilters`
- Gdy server filters aktywne → `visibleExperiences = initialExperiences` (pominięcie viewport filter)
- `useEffect` z `useRef(filterKey)` — reset `setBounds(null)` gdy filterKey zmienia się

#### 10. Fish lib consolidation

Wszystkie hardcoded listy ryb zastąpione `FISH_ALL` z `@/lib/fish`:
- `create-guide-form.tsx`
- `edit-guide-form.tsx`
- `guide-onboarding.tsx`
- `onboarding-wizard.tsx`
- `experience-form.tsx` (już było)

#### 11. Country filter — ilike fix (`queries.ts`)

**Problem**: `location_country` to free-text — guides wpisywali "sweden", "Sverige" etc.
`.eq()` case-sensitive → Iceland/Sweden filter nie działał.

**Fix** w obu funkcjach (`getExperiences` + `getAllExperiencesWithCoords`):
```typescript
// Pojedynczy kraj:
query = query.ilike('location_country', countryList[0])
// Wiele krajów:
query = query.or(countryList.map(c => `location_country.ilike.${c}`).join(','))
// Technique:
query = query.ilike('technique', params.technique)
// + .trim() przy split(',')
```

**Companion fix**: experience-form.tsx country → `<select>` z `COUNTRIES` lib (normalizacja nowych danych)

---

### Instrukcja od Tymona

**NIE pushować do GitHub automatycznie.** Commit/push tylko gdy Tymon o to jawnie poprosi.

---

### Pliki kluczowe

| Ścieżka | Opis |
|---------|------|
| `src/app/trips/page.tsx` | Listing z filtrami (SSR) |
| `src/app/trips/[id]/page.tsx` | Szczegóły experience + booking |
| `src/app/trips/map-view.tsx` | Mapa z pinami, area polygon, pinnedAreaId |
| `src/components/trips/experience-form.tsx` | Formularz create/edit z crop, MultiImageUpload, icelandic |
| `src/components/trips/booking-widget.tsx` | Sidebar sticky z kalkulatorem ceny |
| `src/components/trips/duration-cards-selector.tsx` | Interaktywne karty "Choose your duration" |
| `src/components/admin/image-upload.tsx` | CropModal (Canvas API), Strict Mode safe |
| `src/actions/experiences.ts` | Server Actions create/update/delete |
| `src/lib/supabase/queries.ts` | Query builder z filtrami |
