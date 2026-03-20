# FjordAnglers — Trip Page Spec

> Wersja: 1.1 · Aktualizacja: 2026-03-20

---

## Architektura stron

| Strona | URL | Cel |
|---|---|---|
| **Trip listing** | `/trips` | Search + filtry, karty tripów |
| **Trip detail** | `/trips/[id]` | Pełna strona tripu + booking/inquiry |
| **Inquiry form** | `/trips/[id]/inquire` | Wizard z zapytaniem do przewodnika |
| **Guide profile** | `/guides/[id]` | Kim jest przewodnik + lista jego tripów |
| **Plan Your Trip** | `/plan-your-trip` | Concierge flow dla złożonych tripów |

**Zasada:** Angler szuka **tripu**, nie przewodnika. Trip to produkt — guide to kontekst.

---

## Booking types (`experiences.booking_type`)

| Typ | Opis | Flow |
|---|---|---|
| `direct` | Instant booking | Wybierz datę → zapłać przez Stripe Elements → `confirmed` |
| `icelandic` | Price on request | Wyślij inquiry → guide wysyła ofertę → zapłać → `confirmed` |
| `both` | Oba dostępne | Angler wybiera preferowany sposób |

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

### 3. Opis
- `description` — pełny tekst, markdown
- `location_description` — osobny akapit opisujący konkretne miejsce połowu

### 4. Plan wycieczki
- `itinerary` — JSONB z harmonogramem
```json
[
  { "time": "06:00", "label": "Departure from Tromsø harbour" },
  { "time": "07:30", "label": "Arrive at fishing spot" },
  { "time": "12:00", "label": "Lunch break on the boat" },
  { "time": "15:00", "label": "Return to harbour" }
]
```

### 5. Pakiety (Packages)
Każdy trip ma 1–4 pakiety. Pakiet = konkretna opcja wybierana przy bookingu.

```json
{
  "id": "full-day",
  "label": "Full Day",
  "duration_hours": 8,
  "duration_days": null,
  "pricing_model": "per_person",
  "price_eur": 350,
  "group_prices": null,
  "level": "intermediate",
  "max_group": 4,
  "min_group": 1,
  "availability": {
    "season_from": 6,
    "season_to": 9,
    "blocked_dates": [],
    "notes": "Weekdays only"
  }
}
```

**Modele cenowe:**
| `pricing_model` | Opis |
|---|---|
| `per_person` | €350/os × liczba osób |
| `per_boat` | €800 za całą łódź |
| `per_group` | Stała cena per rozmiar grupy (`group_prices: { "1": 150, "2": 270 }`) |

### 6. Inclusions
`inclusions` JSONB — checkboxy co jest/nie jest w cenie:
```json
{
  "rods": true, "tackle": true, "bait": false,
  "boat": true, "safety_gear": true, "license": false,
  "lunch": false, "drinks": false, "fish_cleaning": true,
  "transport": false, "accommodation": false,
  "custom": ["Waders available on request"]
}
```
Sekcja "What's NOT included" auto-generuje się z pól `false`.
Jeśli `license: false` → auto-link do `/license-map`.

### 7. Szczegóły logistyczne (opcjonalne)
Sekcja pojawia się tylko jeśli pole wypełnione:

| Pole DB | Sekcja UI |
|---|---|
| `boat_description` | Boat Info |
| `accommodation_description` | Accommodation |
| `food_description` | Food & Drinks |
| `license_description` | Fishing Licence |
| `gear_description` | Gear & Equipment |
| `transport_description` | Getting There |

### 8. Lokalizacja spotkania
- `meeting_point_address` — tekst
- `meeting_point_lat` / `meeting_point_lng` — mapa

### 9. O przewodniku
Dane z tabeli `guides`: avatar, imię, bio, lokalizacja, lata doświadczenia, języki, certyfikaty, ocena.

### 10. Inne tripy tego przewodnika
Max 3 karty tripów tego samego guide'a.

---

## Inquiry Form (`/trips/[id]/inquire`)

4-zakładkowy wizard:

| Zakładka | Pola |
|---|---|
| **Trip** | Typ tripu, liczba dni, DateRangePicker (calendar range picker) |
| **Group** | Rozmiar grupy, beginners/children, gatunki docelowe, poziom doświadczenia |
| **Needs** | Sprzęt, nocleg, transport, łódź, dieta |
| **Extras** | Gdzie nocuje, fotografia, doświadczenie w regionie, budżet, notatki |

**Konfiguracja pól** (`inquiry_form_config` JSONB na experiences):
- Każde pole: `'required'` / `'optional'` / `'hidden'`
- Zawsze wymagane (nie konfigurowalne): daty, rozmiar grupy, gatunki
- Edytor: `InquiryFormConfigEditor` w `/dashboard/trips/[id]/edit`

---

## Wymagane pola do publikacji (`published = true`)

| Pole | Typ |
|---|---|
| `title` | text NOT NULL |
| `description` | text NOT NULL |
| `location_country` | text NOT NULL |
| `fish_types` | text[] (min 1) |
| `packages` | jsonb (min 1 pakiet) |
| `season_from` | int NOT NULL |
| `season_to` | int NOT NULL |
| `images` lub `landscape_url` | min 1 zdjęcie |
| `guide_id` | uuid NOT NULL |
| `booking_type` | text NOT NULL |

---

## Trip Listing `/trips`

### Filtry (URL search params)
```
?country=NO            kraj
?fish=salmon           gatunek
?method=fly-fishing    metoda
?level=beginner        poziom
?month=7               miesiąc sezonu
?sort=price_asc        sortowanie
?page=1                paginacja
```

### Karta tripu (ExperienceCard)
- Zdjęcie (next/image, fill)
- Kraj + lokalizacja
- Tytuł
- Gatunki ryb (tagi)
- Cena od (najniższy pakiet)
- Avatar + imię guide'a
- CTA: "View Trip"

---

## SEO

- `slug` (unique) → docelowy URL: `/trips/[slug]` (aktualnie `/trips/[id]`)
- `generateMetadata` z `title`, `description`, `openGraph.images`
- `sitemap.ts` generuje wpisy dla wszystkich `published = true` tripów
- `location_description` + `description` → treść indeksowana przez Google
