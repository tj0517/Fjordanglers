# FjordAnglers — Trip Page Spec

> Version: 1.0 · Date: 2026-03-16
> Status: Active — source of truth for trip listing, packages, availability, booking

---

## Architektura stron

| Strona | URL | Cel |
|---|---|---|
| **Trip listing** | `/trips` | Search + filtry, karty tripów |
| **Trip detail** | `/trips/[id]` | Pełna strona tripu + booking |
| **Guide profile** | `/guides/[id]` | Kim jest przewodnik + lista jego tripów |
| **Plan Your Trip** | `/plan-your-trip` | Concierge flow dla złożonych tripów |

Angler szuka **tripu**, nie przewodnika. Trip to produkt — guide to kontekst.

---

## Sekcje strony tripu `/trips/[id]`

### 1. Galeria
- Główne zdjęcie fullwidth + miniaturki
- `images[]` z Supabase Storage
- `landscape_url` jako fallback hero

### 2. Header
- Tytuł tripu (`title`)
- Lokalizacja: kraj + miasto/obszar (`location_country`, `location_area`, `location_city`)
- Tagi: gatunki ryb (`fish_types`), metody połowu (`fishing_methods`)
- Sezon: `season_from → season_to` (miesiące)
- Trudność: z wybranego pakietu

### 3. Opis
- `description` — pełny tekst, markdown
- `location_description` — osobny akapit opisujący konkretne miejsce połowu (rzeka, jezioro, fjord)

### 4. Plan wycieczki
- `itinerary` — JSONB lub tekst z harmonogramem dnia/dni
  ```json
  [
    { "time": "06:00", "label": "Departure from Tromsø harbour" },
    { "time": "07:30", "label": "Arrive at fishing spot" },
    { "time": "12:00", "label": "Lunch break on the boat" },
    { "time": "15:00", "label": "Return to harbour" }
  ]
  ```

### 5. Pakiety (Packages)
Każdy trip ma 1–4 pakiety. Pakiet = konkretna opcja którą angler wybiera przy bookingu.

```json
[
  {
    "id": "half-day",
    "label": "Half Day",
    "duration_hours": 4,
    "duration_days": null,
    "pricing_model": "per_person",
    "price_eur": 150,
    "group_prices": null,
    "level": "all",
    "max_group": 4,
    "min_group": 1,
    "availability": {
      "season_from": 6,
      "season_to": 9,
      "blocked_dates": ["2026-07-15"],
      "notes": "Weekdays only"
    }
  },
  {
    "id": "full-day",
    "label": "Full Day",
    "duration_hours": 8,
    "duration_days": null,
    "pricing_model": "per_boat",
    "price_eur": 800,
    "group_prices": null,
    "level": "intermediate",
    "max_group": 3,
    "min_group": 1,
    "availability": {
      "season_from": 6,
      "season_to": 8,
      "blocked_dates": [],
      "notes": null
    }
  }
]
```

**Modele cenowe pakietu:**
| `pricing_model` | Opis |
|---|---|
| `per_person` | €150/os × liczba osób |
| `per_boat` | €800 za całą łódź, bez względu na rozmiar grupy |
| `per_group` | Stała cena za grupę, ale zróżnicowana per rozmiar |

Jeśli `pricing_model = per_group`, to `group_prices` to mapa: `{ "1": 150, "2": 270, "3": 360 }`

**Poziomy:**
`all` | `beginner` | `intermediate` | `expert`

### 6. Co zawiera cena (Inclusions)
`inclusions` JSONB — checkboxy + opcjonalne custom items:

```json
{
  "rods": true,
  "tackle": true,
  "bait": false,
  "boat": true,
  "safety_gear": true,
  "license": false,
  "lunch": false,
  "drinks": false,
  "fish_cleaning": true,
  "transport": false,
  "accommodation": false,
  "custom": ["Waders available on request", "Catch photos included"]
}
```

UI auto-generuje sekcję "What's NOT included" z pól = false.
Jeśli `license: false` → auto-link do `/license-map?region=<license_region>`.

### 7. Szczegóły logistyczne

Każdy z poniższych to osobne pole TEXT — guide może wpisać co chce lub zostawić puste:

| Pole DB | Sekcja na stronie | Przykład |
|---|---|---|
| `boat_description` | Boat Info | "6m aluminium boat, 60HP, sonar, max 4 anglers" |
| `accommodation_description` | Accommodation | "Riverside cabin, 2 bedrooms, kitchen, WiFi" |
| `food_description` | Food & Drinks | "Hot lunch provided. Bring your own snacks." |
| `license_description` | Fishing Licence | "Licence required, costs ~€15/day, we help arrange" |
| `gear_description` | Gear & Equipment | "All spinning rods provided. Bring your waders." |
| `transport_description` | Getting There | "Meet at Tromsø harbour, free parking nearby" |

Sekcja pojawia się na stronie **tylko jeśli pole jest wypełnione** — żadnych pustych bloków.

### 8. Lokalizacja spotkania
- `meeting_point_address` — tekst (np. "Tromsø Harbour, Pier 4")
- `meeting_point_lat` / `meeting_point_lng` — mapa

### 9. Dostępność dat
Każdy pakiet ma własne `availability` w JSONB (patrz §5).
Widget na stronie pokazuje:
- Sezon (np. "June – September")
- Ewentualnie zablokowane daty w kalendarzu
- Opis w `availability.notes`

### 10. Opinie
- `reviews` — tabela osobna (FK → experiences.id, FK → angler user)
- Wyświetlane: avatar, imię, ocena (1–5), tekst, data
- Agregat: `average_rating` na poziomie tripu lub guide'a

### 11. O przewodniku (dziedziczone z guide profile)
Sekcja na dole strony tripu — dane z tabeli `guides`:
- Avatar + imię (`avatar_url`, `full_name`)
- Bio (`bio`)
- Lokalizacja (`city`, `country`)
- Lata doświadczenia (`years_experience`)
- Języki (`languages`) ← **dziedziczone automatycznie, guide nie wpisuje per trip**
- Certyfikaty (`certifications`)
- Ocena (`average_rating`, `total_reviews`)
- Link do pełnego profilu `/guides/[id]`

### 12. Inne tripy tego przewodnika
- Max 3 karty tripów tego samego guide'a
- Wyklucza aktualnie oglądany trip

---

## Wymagane pola do publikacji (`published = true`)

Trip **nie może być opublikowany** bez tych pól. DB agent powinien dodać walidację:

| Pole | Typ | Wymagane do publish |
|---|---|---|
| `title` | text | ✅ NOT NULL (już jest) |
| `description` | text | ✅ NOT NULL (już jest) |
| `location_country` | text | ✅ musi być NOT NULL |
| `fish_types` | text[] | ✅ array.length >= 1 |
| `packages` | jsonb | ✅ array.length >= 1 |
| `season_from` | int | ✅ musi być NOT NULL |
| `season_to` | int | ✅ musi być NOT NULL |
| `images` | text[] lub jsonb | ✅ array.length >= 1 LUB landscape_url IS NOT NULL |
| `guide_id` | uuid | ✅ NOT NULL (już jest) |
| `booking_type` | text | ✅ NOT NULL (już jest) |

Walidacja: CHECK constraint `published_requires_fields` lub trigger `before_publish`.

---

## Nowe pola DB do dodania (tabela `experiences`)

```sql
-- Trip content
itinerary               JSONB          -- plan wycieczki (tablica kroków)
location_description    TEXT           -- akapit o miejscu połowu
boat_description        TEXT           -- opis łodzi per trip
accommodation_description TEXT         -- opis noclegu per trip
food_description        TEXT           -- opis wyżywienia per trip
license_description     TEXT           -- opis licencji per trip
gear_description        TEXT           -- opis sprzętu per trip
transport_description   TEXT           -- opis dojazdu per trip

-- Packages (zastępuje duration_options + group_pricing + price_per_person_eur)
packages                JSONB          -- tablica pakietów (patrz §5)
```

---

## Pola do deprecacji / usunięcia (tabela `experiences`)

Poniższe pola są przestarzałe — zastąpione przez nowe lub są duplikatami:

| Pole | Powód | Zastąpione przez |
|---|---|---|
| `duration_hours` | duplikat | `packages[].duration_hours` |
| `duration_days` | duplikat | `packages[].duration_days` |
| `duration_options` | stare JSONB | `packages` |
| `group_pricing` | stare JSONB | `packages[].pricing_model` + `packages[].group_prices` |
| `price_per_person_eur` | duplikat ceny | `packages[].price_eur` |
| `max_guests` | przeniesione | `packages[].max_group` |
| `difficulty` | przeniesione | `packages[].level` |
| `meeting_time` | przeniesione | `packages[].availability.notes` |
| `technique` | duplikat | `fishing_methods` |
| `meeting_point` | stare pole | `meeting_point_address` |
| `location_lat` | duplikat | `location_latitude` → **zostaw `location_lat`, usuń `location_latitude`** |
| `location_lng` | duplikat | `location_longitude` → **zostaw `location_lng`, usuń `location_longitude`** |
| `what_included` | duplikat | `inclusions` JSONB |
| `what_excluded` | duplikat | `inclusions` JSONB (pola = false) |
| `boat_included` | duplikat | `inclusions.boat` |
| `tags` | niejasne | usuń lub przemianuj na `seo_tags` jeśli potrzebne |

> ⚠️ Przed usunięciem kolumn: sprawdź czy są używane w kodzie (`grep -r "column_name" src/`)
> Migracja: najpierw migruj dane, potem DROP COLUMN

---

## Booking Flow

> Status: **TBD — nie implementujemy teraz**

Każdy guide będzie mógł mieć inny flow (instant booking vs request vs concierge).
Szczegóły w osobnym dokumencie gdy zaczniemy implementację.

Placeholder stanów:
- `pending` → `accepted` → `confirmed` → `completed`
- `declined` / `cancelled` / `refunded`

---

## Trips Listing `/trips`

### Filtry (URL search params)
```
?country=NO            kraj (NO, SE, FI, IS, DK)
?fish=salmon           gatunek
?method=fly-fishing    metoda połowu
?level=beginner        poziom
?month=7               miesiąc sezonu
?sort=price_asc        sortowanie
?page=1                paginacja
```

### Karta tripu (ExperienceCard)
- Zdjęcie (next/image, fill, sizes responsive)
- Kraj + lokalizacja
- Tytuł
- Gatunki ryb (tagi)
- Cena od (najniższy pakiet)
- Poziom
- Avatar + imię guide'a
- CTA: "View Trip"

---

## SEO

- Każdy trip ma `slug` (unique) → URL: `/trips/[slug]` (docelowo, aktualnie `/trips/[id]`)
- `generateMetadata` z `title`, `description`, `openGraph.images`
- `sitemap.ts` generuje wpisy dla wszystkich `published = true` tripów
- `location_description` + `description` → treść indeksowana przez Google
