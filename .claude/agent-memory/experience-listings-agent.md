# experience-listings-agent — pamięć

## Sesja 2026-03-15 — UX fixes, crop modal, icelandic flow, map pin, hero

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
— `price_per_person_eur` jest już nullable w DB i w kodzie (`?? null`, nie `?? 0`).

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
