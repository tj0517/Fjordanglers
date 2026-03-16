# DB Agent — Trip Schema Cleanup & Extension

> Źródło prawdy: `docs/trips-spec.md`
> Zadanie: przeprowadź audyt tabeli `experiences`, usuń duplikaty, dodaj nowe pola, dodaj walidację publish

---

## Kontekst

Tabela `experiences` narosła przez kilkanaście migracji i ma:
- zduplikowane kolumny współrzędnych
- stare pola zastąpione przez nowe JSONB
- brakujące pola opisowe per trip
- brak walidacji która uniemożliwia publikację niekompletnego tripu

---

## Zadanie 1 — Usuń duplikaty kolumn

Sprawdź najpierw czy kolumny są używane w kodzie (`src/`), potem usuń:

```sql
-- DUPLIKATY WSPÓŁRZĘDNYCH (zostaw _lat/_lng, usuń _latitude/_longitude)
ALTER TABLE public.experiences
  DROP COLUMN IF EXISTS location_latitude,
  DROP COLUMN IF EXISTS location_longitude;

-- STARE POLA ZASTĄPIONE PRZEZ NOWE
ALTER TABLE public.experiences
  DROP COLUMN IF EXISTS meeting_point,        -- zastąpione przez meeting_point_address
  DROP COLUMN IF EXISTS technique,            -- zastąpione przez fishing_methods
  DROP COLUMN IF EXISTS boat_included,        -- zastąpione przez inclusions.boat
  DROP COLUMN IF EXISTS what_included,        -- zastąpione przez inclusions JSONB
  DROP COLUMN IF EXISTS what_excluded,        -- zastąpione przez inclusions JSONB
  DROP COLUMN IF EXISTS duration_hours,       -- zastąpione przez packages[].duration_hours
  DROP COLUMN IF EXISTS duration_days,        -- zastąpione przez packages[].duration_days
  DROP COLUMN IF EXISTS duration_options,     -- zastąpione przez packages JSONB
  DROP COLUMN IF EXISTS group_pricing,        -- zastąpione przez packages[].pricing_model
  DROP COLUMN IF EXISTS price_per_person_eur, -- zastąpione przez packages[].price_eur
  DROP COLUMN IF EXISTS max_guests,           -- przeniesione do packages[].max_group
  DROP COLUMN IF EXISTS difficulty,           -- przeniesione do packages[].level
  DROP COLUMN IF EXISTS meeting_time,         -- przeniesione do packages[].availability.notes
  DROP COLUMN IF EXISTS tags;                 -- niejasne przeznaczenie, usunąć
```

> ⚠️ Przed każdym DROP: uruchom `grep -r "column_name" /src` i sprawdź czy używane.
> Jeśli używane — zaktualizuj kod najpierw, potem usuń kolumnę.

---

## Zadanie 2 — Dodaj nowe pola opisowe

```sql
ALTER TABLE public.experiences
  -- Plan wycieczki (tablica kroków z czasem i opisem)
  ADD COLUMN IF NOT EXISTS itinerary JSONB,

  -- Akapit opisujący konkretne miejsce połowu (rzeka, jezioro, fjord)
  ADD COLUMN IF NOT EXISTS location_description TEXT,

  -- Szczegóły logistyczne per trip (wyświetlane tylko jeśli wypełnione)
  ADD COLUMN IF NOT EXISTS boat_description TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_description TEXT,
  ADD COLUMN IF NOT EXISTS food_description TEXT,
  ADD COLUMN IF NOT EXISTS license_description TEXT,
  ADD COLUMN IF NOT EXISTS gear_description TEXT,
  ADD COLUMN IF NOT EXISTS transport_description TEXT,

  -- Pakiety: zastępuje duration_options + group_pricing + price_per_person_eur
  -- Struktura: patrz docs/trips-spec.md §5
  ADD COLUMN IF NOT EXISTS packages JSONB;
```

---

## Zadanie 3 — Walidacja "required to publish"

Trip z `published = true` musi mieć:
- `title` NOT NULL (już jest)
- `description` NOT NULL (już jest)
- `location_country` NOT NULL
- `fish_types` array length >= 1
- `packages` array length >= 1 (po migracji danych z `duration_options`)
- `season_from` NOT NULL
- `season_to` NOT NULL
- co najmniej jedno: `images` array >= 1 LUB `landscape_url` IS NOT NULL

```sql
-- Constraint: published trip musi mieć location_country
ALTER TABLE public.experiences
  ADD CONSTRAINT experiences_published_location_country
    CHECK (
      published = FALSE
      OR location_country IS NOT NULL
    );

-- Constraint: published trip musi mieć sezon
ALTER TABLE public.experiences
  ADD CONSTRAINT experiences_published_season
    CHECK (
      published = FALSE
      OR (season_from IS NOT NULL AND season_to IS NOT NULL)
    );

-- Constraint: published trip musi mieć pakiety lub landscape (zdjęcie)
ALTER TABLE public.experiences
  ADD CONSTRAINT experiences_published_has_image
    CHECK (
      published = FALSE
      OR landscape_url IS NOT NULL
      OR (images IS NOT NULL AND jsonb_array_length(images::jsonb) > 0)
      OR (images IS NOT NULL AND array_length(images, 1) > 0)
    );

-- Constraint: published trip musi mieć pakiety (po migracji danych)
-- UWAGA: dodaj ten constraint DOPIERO po migracji danych z duration_options → packages
-- ALTER TABLE public.experiences
--   ADD CONSTRAINT experiences_published_has_packages
--     CHECK (
--       published = FALSE
--       OR (packages IS NOT NULL AND jsonb_array_length(packages) >= 1)
--     );
```

---

## Zadanie 4 — Migruj dane z starych pól do packages

Przed usunięciem `duration_options`, `group_pricing`, `price_per_person_eur` —
przenieś dane do nowego pola `packages`:

```sql
-- Migracja: duration_options → packages (jeśli duration_options nie jest null)
UPDATE public.experiences
SET packages = duration_options
WHERE packages IS NULL
  AND duration_options IS NOT NULL;

-- Migracja: jeśli nie ma duration_options ale jest price_per_person_eur,
-- stwórz podstawowy pakiet
UPDATE public.experiences
SET packages = jsonb_build_array(
  jsonb_build_object(
    'id', 'standard',
    'label', 'Standard',
    'duration_hours', NULL,
    'duration_days', NULL,
    'pricing_model', 'per_person',
    'price_eur', price_per_person_eur,
    'group_prices', NULL,
    'level', 'all',
    'max_group', 8,
    'min_group', 1,
    'availability', jsonb_build_object(
      'season_from', season_from,
      'season_to', season_to,
      'blocked_dates', '[]'::jsonb,
      'notes', NULL
    )
  )
)
WHERE packages IS NULL
  AND price_per_person_eur IS NOT NULL;
```

---

## Zadanie 5 — Indeksy dla nowych pól

```sql
-- GIN index dla packages (filtrowanie po level, pricing_model)
CREATE INDEX IF NOT EXISTS idx_experiences_packages
  ON public.experiences USING GIN (packages)
  WHERE packages IS NOT NULL AND published = TRUE;
```

---

## Zadanie 6 — Odśwież typy TypeScript

Po wszystkich migracjach uruchom:

```bash
pnpm supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

Lub jeśli używasz remote:
```bash
pnpm supabase gen types typescript --project-id <project-id> > src/lib/supabase/database.types.ts
```

---

## Kolejność wykonania

1. `grep` każdej kolumny do usunięcia w `src/` — zaktualizuj kod jeśli używane
2. Zadanie 4 — migracja danych (duration_options → packages)
3. Zadanie 2 — dodaj nowe kolumny
4. Zadanie 1 — usuń stare kolumny (po migracji danych)
5. Zadanie 3 — dodaj constraints (packages constraint na końcu)
6. Zadanie 5 — indeksy
7. Zadanie 6 — regeneruj typy TypeScript
8. `pnpm typecheck` — zero błędów

---

## Weryfikacja po migracji

```sql
-- Sprawdź że nie ma duplikatów
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'experiences'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Sprawdź że opublikowane tripy mają wymagane pola
SELECT id, title, location_country, season_from, season_to, packages
FROM public.experiences
WHERE published = TRUE
  AND (
    location_country IS NULL
    OR season_from IS NULL
    OR packages IS NULL
  );
-- Wynik powinien być pusty (0 rows)
```
