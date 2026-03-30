# FjordAnglers — Kompletna konfiguracja przewodnika

> **Jak używać tego dokumentu:** Wklej go do rozmowy z Claude razem z zadaniem (np. „Skonfiguruj przewodnika X wg tego dokumentu"). Claude będzie wiedział dokładnie co zrobić.

---

## Kontekst systemu

FjordAnglers to marketplace łączący skandynawskich przewodników wędkarskich z wędkarzami. Stack: Next.js (App Router), Supabase, Stripe Connect.

**Dwie role:**
- **Admin** → `src/app/admin/` — tworzy i zarządza profilami przewodników
- **Guide** → `src/app/dashboard/` — zarządza swoim profilem, tripami, kalendarzem, rezerwacjami

**Flow aktywacji przewodnika:**
```
Admin tworzy listing → Guide rejestruje się (ten sam email) → auto-link → Guide konfiguruje Stripe → Admin tworzy tripy → Guide jest live
```

---

## FAZA 1 — Admin tworzy profil przewodnika

### Ścieżka: `/admin/guides/new`
### Akcja serwerowa: `createBetaGuide(payload: BetaGuidePayload)`
### Plik: `src/actions/admin.ts`

#### Pola obowiązkowe

| Pole | Typ | Uwagi |
|------|-----|-------|
| `full_name` | `string` | Imię i nazwisko przewodnika |
| `country` | `string` | Pełna nazwa kraju lub kod 2-literowy (np. `"Norway"` lub `"NO"`) |
| `languages` | `string[]` | Min. 1. Opcje: `English`, `Norwegian`, `Swedish`, `Finnish`, `Icelandic`, `Danish`, `German`, `Polish`, `French` |
| `fish_expertise` | `string[]` | Min. 1 gatunek. Z listy `FISH_ALL` (Salmon, Sea Trout, Arctic Char, Brown Trout, Grayling, Pike, Perch, Zander, Halibut, Cod…) |
| `pricing_model` | `'commission' \| 'flat_fee'` | **Zawsze `'commission'`** dla nowych przewodników (10%). `flat_fee` to legacy. |

#### Pola opcjonalne (bardzo zalecane)

| Pole | Typ | Uwagi |
|------|-----|-------|
| `city` | `string` | Region/miasto (np. `"Voss"`, `"Tromsø"`) |
| `bio` | `string` | Opis przewodnika (wyświetlany publicznie) |
| `years_experience` | `number` | Lata doświadczenia (0–70) |
| `avatar_url` | `string` | URL zdjęcia profilowego (proporcje 1:1, kwadrat) |
| `cover_url` | `string` | URL zdjęcia okładkowego (proporcje 16:9) |
| `landscape_url` | `string \| null` | URL zdjęcia hero na stronie profilu (16:9); można wybrać z biblioteki krajobrazów lub wgrać własne |
| `instagram_url` | `string` | Handle `@xyz` lub pełny URL |
| `youtube_url` | `string` | Pełny URL kanału |
| `gallery_images` | `GuideGalleryImage[]` | Maks. 5 zdjęć galerii; każde: `{ url, is_cover, sort_order }` |
| `invite_email` | `string` | Email do auto-linkowania konta: gdy Guide rejestruje się tym adresem, zostaje automatycznie powiązany z tym profilem |
| `lead_id` | `string` | ID leada (jeśli profil pochodzi z formularza aplikacyjnego); lead zostaje oznaczony jako `onboarded` |

#### Co system ustawia automatycznie

```
user_id          = NULL (uzupełniane po rejestracji Guide)
is_beta_listing  = true
status           = 'active'
verified_at      = NOW()
commission_rate  = 0.10
is_hidden        = false
created_at       = NOW()
```

> **Ważne:** Po `createBetaGuide` przewodnik jest od razu **widoczny publicznie** na `/guides`. Aby go ukryć przed startem, ustaw `is_hidden = true` ręcznie w Supabase lub przez edit po utworzeniu.

---

## FAZA 2 — Admin edytuje profil przewodnika

### Ścieżka: `/admin/guides/[id]/edit`
### Akcja: `updateGuide(guideId, payload)`

Wszystkie pola z Fazy 1 można edytować, plus:

| Pole | Typ | Uwagi |
|------|-----|-------|
| `status` | `'pending' \| 'verified' \| 'active' \| 'suspended'` | Zmiana statusu. `verified_at` ustawiane automatycznie przy pierwszym przejściu na `active`/`verified` |
| `invite_email` | `string \| null` | Można wyczyścić (`null`) żeby rozpiąć auto-link |
| `commission_rate` | `number` | Tylko dla **Founding Guide**: ustaw `0.08` (8% przez 24 miesiące od `created_at`). Standardowo `0.10` |
| `is_hidden` | `boolean` | `true` = ukryty z publicznego listingu (ale istniejące rezerwacje działają normalnie) |

#### Zarządzanie zdjęciami (EditGuideForm)
- **Avatar** — przycisk upload → crop modal (1:1) → zapis do Supabase Storage
- **Cover** — upload → crop modal (16:9)
- **Landscape** — wybór z biblioteki (`LANDSCAPE_LIBRARY`) LUB custom upload (16:9)
- **Galeria** — do 5 zdjęć; drag-and-drop sortowanie; każde można crop'ować; pierwsze z `is_cover=true` to okładka galerii

---

## FAZA 3 — Guide rejestruje się (auto-link)

Gdy Guide rejestruje konto z **tym samym emailem co `invite_email`**:

1. Supabase wysyła magic link / email confirmation
2. `/auth/callback` sprawdza email → znajduje pasujący profil przewodnika
3. Automatycznie:
   - `guides.user_id = auth.user.id`
   - `guides.is_beta_listing = false`
4. Guide zostaje przekierowany do `/dashboard`

> **Jeśli Guide już istnieje w Supabase Auth** (ma inne konto): link można wykonać ręcznie przez Supabase SQL:
> ```sql
> UPDATE guides SET user_id = 'AUTH_USER_UUID' WHERE id = 'GUIDE_UUID';
> ```

---

## FAZA 4 — Guide konfiguruje wypłaty (Stripe Connect)

### Ścieżka: `/dashboard/account`

#### Opcja A: Stripe Express (zalecana, 95% przypadków)

**Kroki Guide:**
1. Klika "Connect with Stripe"
2. System tworzy Express account z pre-fill:
   - `email` z konta auth
   - `full_name` z profilu
   - `country` (kod 2-literowy, normalizowany z `guides.country`)
   - `business_type: 'individual'`
   - `mcc: '7999'` (recreation services)
   - `capabilities: { card_payments, transfers }`
   - `payout_schedule: manual`
3. Guide wypełnia formularz Stripe (dane osobowe, weryfikacja tożsamości)
4. Stripe webhook syncuje status:
   - `stripe_charges_enabled = true` → może przyjmować depozyty
   - `stripe_payouts_enabled = true` → gotowy na wypłaty

**Pola DB po Stripe onboarding:**
```
stripe_account_id      = "acct_xxxxx"
stripe_charges_enabled = true
stripe_payouts_enabled = true
```

**Kraje bez Stripe:**
- **Islandia (IS)** i **Chorwacja (HR)** — Stripe niedostępny. Guide widzi komunikat:
  > "Stripe not available in your country — contact support for manual payouts"
- Obsługa: ręczna wypłata przelewem na konto IBAN (patrz Opcja B)

#### Opcja B: Konto bankowe IBAN (Custom / legacy)

Używana gdy: kraj bez Stripe LUB Guide preferuje tradycyjny przelew.

**Pola do wypełnienia przez Guide (BankAccountForm):**

| Pole | Wymagane | Uwagi |
|------|----------|-------|
| `firstName` | TAK | Zgodnie z dowodem tożsamości |
| `lastName` | TAK | Zgodnie z dowodem tożsamości |
| `dobDay` / `dobMonth` / `dobYear` | TAK | Data urodzenia; min. 18 lat |
| `addressLine1` | TAK | Adres zamieszkania |
| `addressCity` | TAK | Miasto |
| `addressPostalCode` | TAK | Kod pocztowy (3–20 znaków) |
| `country` | TAK | Kod 2-literowy (lista COUNTRIES, bez IS i HR) |
| `iban` | TAK | 15–34 znaki, format `CC00XXXX...` (auto-formatowanie co 4 znaki) |

**Po zapisaniu w DB:**
```
iban             = "NO1234567890123"
iban_holder_name = "Lars Hansen"
iban_bic         = "DNBANOKK" (opcjonalnie)
iban_bank_name   = "DNB Bank" (opcjonalnie)
```

> Te dane NIE są wysyłane do wędkarzy. Służą do ręcznych przelewów przez admina.

---

## FAZA 5 — Guide konfiguruje preferencje

### Ścieżka: `/dashboard/account`

| Ustawienie | Pole DB | Opcje | Default |
|-----------|---------|-------|---------|
| Metody płatności | `accepted_payment_methods` | `['cash']`, `['online']`, `['cash','online']` | `['online']` |
| Domyślna metoda salda | `default_balance_payment_method` | `'cash'` \| `'online'` | `'online'` |
| Zgoda na użycie zdjęć w marketingu | `photo_marketing_consent` | `true` \| `false` | `false` |
| Ukryj profil publicznie | `is_hidden` | `true` \| `false` | `false` |

---

## FAZA 6 — Admin tworzy tripy (Experiences)

### Ścieżka: `/admin/guides/[id]/trips/new`

#### Pola doświadczenia (experiences table)

**Podstawowe (obowiązkowe):**

| Pole | Typ | Uwagi |
|------|-----|-------|
| `title` | `string` | Nazwa tripu |
| `guide_id` | `string` | FK do guides.id |
| `fish_types` | `string[]` | Gatunki; z FISH_ALL |
| `max_guests` | `number` | Maks. uczestników (1–20) |
| `price_per_person_eur` | `number` | Cena bazowa w EUR |
| `difficulty` | `'beginner' \| 'intermediate' \| 'expert'` | Poziom trudności |
| `booking_type` | `'classic' \| 'icelandic' \| 'both'` | Typ rezerwacji (patrz niżej) |
| `technique` | `string` | Np. `'Fly fishing'`, `'Spinning'`, `'Lure fishing'` |
| `catch_and_release` | `boolean` | Polityka C&R |
| `location_city` | `string` | Miasto/region tripu |
| `location_country` | `string` | Kraj tripu |
| `meeting_point` | `string` | Miejsce zbiórki |
| `meeting_point_address` | `string` | Pełny adres |
| `season_from` / `season_to` | `number` | Miesiące (1–12); np. `4` / `10` = kwiecień–październik |
| `published` | `boolean` | `true` = widoczny publicznie |

**Pola opcjonalne (zalecane):**

| Pole | Typ | Uwagi |
|------|-----|-------|
| `description` | `string` | Szczegółowy opis tripu |
| `duration_hours` | `number \| null` | Dla half/full day (np. `4`, `8`) |
| `duration_days` | `number \| null` | Dla multi-day (np. `3`) |
| `fishing_methods` | `string[]` | Techniki wędkarskie |
| `location_lat` / `location_lng` | `number` | GPS tripu |
| `meeting_point_lat` / `meeting_point_lng` | `number` | GPS miejsca zbiórki |
| `slug` | `string` | URL-friendly (auto-generowany) |

**Struktury JSON:**

```typescript
// duration_options — co angler może wybrać
duration_options: [
  { label: 'Half day (4h)', hours: 4, price_eur: 150, includes_lodging: false },
  { label: 'Full day (8h)', hours: 8, price_eur: 250, includes_lodging: false },
  { label: '3-day package', days: 3, price_eur: 600, includes_lodging: true },
]

// inclusions — co jest w cenie
inclusions: {
  rods: true, tackle: true, bait: false, boat: true,
  safety: true, license: false, lunch: true, drinks: false,
  fish_cleaning: true, transport: false, accommodation: false,
  custom: ['Waterproof jacket rental', 'Fish smoking service'],
}

// group_pricing — opcjonalne zróżnicowanie cen grupowych
group_pricing: {
  model: 'per_size',
  prices: { '1': 300, '2': 250, '3': 220, '4': 200 } // EUR per person
}
// LUB flat:
group_pricing: {
  model: 'flat',
  prices: { '1': 300, '2': 300, '4': 300 } // cały group płaci tyle samo
}
```

#### Typy rezerwacji (`booking_type`)

| Wartość | Opis |
|---------|------|
| `'classic'` | Bezpośrednia rezerwacja przez Stripe Elements (`/book/[expId]`). Angler może też wysłać zapytanie (tryb "Message first"). |
| `'icelandic'` | Tylko zapytania (`/trips/[id]/inquire`). Guide odpowiada ofertą. Płatność przez Stripe Checkout. |
| `'both'` | Oba powyższe dostępne. |

#### Zdjęcia doświadczenia (`experience_images`)

```typescript
{ experience_id: string; url: string; is_cover: boolean; sort_order: number }
```
- Min. 1 zdjęcie (okładka z `is_cover = true`)
- Upload do Supabase Storage bucket `experience-images`

---

## FAZA 7 — Guide konfiguruje kalendarz dostępności

### Ścieżka: `/dashboard/calendar`

Kalendarz kontroluje kiedy Guide jest dostępny.

#### Weekly Schedule (tygodniowy harmonogram)

Tabela `guide_weekly_schedules`:
```typescript
{
  guide_id:         string
  period_from:      string  // ISO date, np. "2025-04-01"
  period_to:        string  // ISO date, np. "2025-10-31"
  blocked_weekdays: number[] // 0=Mon, 1=Tue, ..., 6=Sun
}
```
Przykład: `blocked_weekdays: [0, 6]` = niedostępny poniedziałki i niedziele.

#### Blocked Ranges (ręczne blokowanie dni)

Tabela `guide_blocked_dates` (lub `experience_blocked_dates`):
```typescript
{
  guide_id:   string
  date_start: string  // ISO date
  date_end:   string  // ISO date
  reason?:    string  // opcjonalnie
}
```

---

## Checklist — przewodnik gotowy do startu

### Minimum viable (musi być):
- [ ] Profil stworzony przez admina (full_name, country, languages, fish_expertise)
- [ ] `status = 'active'`, `is_hidden = false`
- [ ] Co najmniej 1 opublikowany trip (`published = true`)
- [ ] Trip ma co najmniej 1 zdjęcie (cover)
- [ ] Stripe Connect skonfigurowany LUB IBAN zapisany (żeby przyjmować płatności)

### Recommended (żeby profil wyglądał dobrze):
- [ ] Bio napisane
- [ ] Avatar (zdjęcie kwadratowe)
- [ ] Cover photo (16:9)
- [ ] Landscape photo (hero, 16:9)
- [ ] Galeria zdjęć (2–5 sztuk)
- [ ] Instagram / YouTube (jeśli ma)
- [ ] Trip z pełnym opisem, DurationOptions, Inclusions, GPS
- [ ] Kalendarz dostępności skonfigurowany (weekly schedule)
- [ ] `accepted_payment_methods` ustawione

### Founding Guide (specjalny status):
- [ ] `commission_rate = 0.08` ustawione ręcznie przez admina w edit
- [ ] Dotyczy pierwszych 24 miesięcy od `created_at`
- [ ] Po 24 miesiącach automatycznie przechodzi na `0.10` (obliczane runtime)

---

## Statusy przewodnika

| Status | Znaczenie | Publiczny? |
|--------|-----------|------------|
| `pending` | Oczekuje na weryfikację | NIE |
| `verified` | Zweryfikowany, widoczny | TAK |
| `active` | Aktywny (default po `createBetaGuide`) | TAK |
| `suspended` | Zawieszony | NIE |

> `is_hidden = true` przy dowolnym statusie → nie widoczny publicznie

---

## Kluczowe pliki w kodzie

| Co | Plik |
|----|------|
| Tworzenie przewodnika | `src/actions/admin.ts` → `createBetaGuide()` |
| Edycja przewodnika | `src/actions/admin.ts` → `updateGuide()` |
| Stripe Connect | `src/actions/stripe-connect.ts` |
| IBAN / Bank account | `src/app/dashboard/account/BankAccountForm.tsx` |
| Formularz tworzenia (admin UI) | `src/components/admin/create-guide-form.tsx` |
| Formularz edycji (admin UI) | `src/components/admin/edit-guide-form.tsx` |
| Typy bazy danych | `src/lib/supabase/database.types.ts` |
| Lista krajów | `src/lib/countries.ts` |
| Lista gatunków ryb | `src/lib/fish.ts` |
| Biblioteka krajobrazów | `src/lib/landscapes.ts` |
| Przykładowe dane (mock) | `src/lib/mock-data.ts` |
| Typy doświadczeń | `src/actions/experiences.ts` |

---

## Walidacja pól (ważne reguły)

| Pole | Reguła |
|------|--------|
| `full_name` | Wymagane, niepuste |
| `languages` | Min. 1 język |
| `fish_expertise` | Min. 1 gatunek |
| `iban` | 15–34 znaki, regex: `/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/` |
| `country` (Stripe) | Musi być w liście COUNTRIES; IS i HR nieobsługiwane przez Stripe |
| `dobYear` (Stripe setup) | Guide musi mieć min. 18 lat |
| `commission_rate` | `0.08` (Founding) lub `0.10` (standard) |
| `pricing_model` | Tylko `'commission'` lub `'flat_fee'` |
| `booking_type` | Tylko `'classic'`, `'icelandic'`, lub `'both'` |
| `status` | Tylko `'pending'`, `'verified'`, `'active'`, `'suspended'` |

---

## Notatki operacyjne

1. **Stripe webhook** musi być zarejestrowany w Stripe Dashboard → zdarzenia `account.updated` aktualizują `stripe_charges_enabled` i `stripe_payouts_enabled`.

2. **Email invite** (`invite_email`) to jednorazowy mechanizm — po auto-linku pole pozostaje w DB ale nie jest już używane do matchowania.

3. **Founding Guide**: ustaw `commission_rate = 0.08` w ciągu **pierwszych kilku minut** po utworzeniu (lub w edit). System nie robi tego automatycznie — trzeba ręcznie.

4. **Publiczność profilu**: nawet przy `status = 'active'` można ukryć profil ustawiając `is_hidden = true`. Istniejące rezerwacje i chaty działają normalnie.

5. **Slug**: generowany automatycznie z `full_name + city`. Można nadpisać ręcznie. URL profilu: `/guides/[slug]`.

6. **Stripe payout schedule**: zawsze `manual`. FjordAnglers ręcznie wyzwala wypłatę po zakończeniu tripu przez panel admina (`/admin/guides/[id]/payouts`).
