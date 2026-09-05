---
id: FA-0.11
title: Cena mówi prawdę — jeden `formatPrice` z `currency` strony i jednostką ceny
stage: 0
status: review
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/price-currency-unit
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 3
owner: tj
---

# FA-0.11 — Cena mówi prawdę: `formatPrice` z `currency` i jednostką

**Skąd to zadanie (audyt lejka 5 IX 2026).** Reklama Bariloche mówi „From $550/Day for Two",
strona pokazuje „from €550 / person". Coyhaique: reklama „$600/Day, All Included", strona
„from €600 / person" (Alex bierze $600 za jednego, $685 za dwóch). Symbol `€` jest zaszyty
na sztywno w trzech kopiach tej samej funkcji, a kolumna `experience_pages.currency` istnieje
i nie jest czytana. Para klikająca reklamę Bariloche widzi cenę ~2,2× wyższą niż realna.
To samo dotyczy stron NZ (NZD).

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły; `docs/03-conventions.md`
- `src/app/experiences/[slug]/page.tsx:117` — `formatPrice` (kopia 1) + `generateMetadata`
  linia ~62: opis meta z `From €${page.price_from}` (czwarte miejsce z `€` na sztywno)
- `src/components/trips/TripOptionsAccordion.tsx:49` — kopia 2 (ceny opcji)
- `src/app/trips/exp-page-map-section.tsx:34` — kopia 3 (karty na `/trips`)
- `src/lib/supabase/database.types.ts` — `experience_pages.currency: string`,
  `experience_pages.price_type: string` (DB default `'per_person'`); `experience_page_options.price_from/price_type`
  **nie mają własnej waluty** — opcja dziedziczy walutę strony
- `docs/tasks/FA-0.05.md` „Notatki z realizacji" — jak uruchomić lokalny stack i skąd wziąć env

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Każda cena na stronie, na `/trips` i w meta description jest w walucie z `experience_pages.currency`
i z jednostką, która odpowiada temu, co przewodnik faktycznie sprzedaje. Jedna funkcja, zero
kopii, zero `€` w literałach poza nią. Reklama i strona pokazują tę samą liczbę z tym samym
symbolem.

## Zakres
- [ ] **Odczyt bieżącego stanu** (kod): otwórz trzy kopie `formatPrice` i `generateMetadata`;
      `grep -rn "€" src --include=*.tsx --include=*.ts` — lista wszystkich miejsc z symbolem na sztywno
      (wklej do raportu; maile w `src/emails/` są poza zakresem, ale wymień je).
- [ ] **Odczyt bieżącego stanu** (dane, produkcja, tylko SELECT — wykonuje tj albo agent z read-only):
      ```sql
      select slug, country, currency, price_type, price_from, status
      from experience_pages
      where country in ('Argentina','Chile','New Zealand') order by country, slug;
      select ep.slug, o.label, o.price_from, o.price_type
      from experience_page_options o join experience_pages ep on ep.id = o.experience_page_id
      where ep.country in ('Argentina','Chile') order by 1,2;
      ```
      Jeśli `currency` dla stron Patagonii/NZ to `EUR` — to jest bloker danych, patrz Bramki STOP.
- [ ] `src/lib/format-price.ts`: `formatPrice({ priceFrom, priceType, currency })` → symbol z mapy
      `{EUR:'€', USD:'$', NZD:'NZ$', GBP:'£', SEK:'SEK ', NOK:'NOK ', ISK:'ISK '}`; nieznana waluta →
      kod ISO z prefiksem, nigdy `€`. Jednostki: `per_person` → „/ person", `flat` → „per trip"
      (nie „for the group" — patrz pytanie w STOP), `request` → „Price on request".
- [ ] Trzy kopie usunięte, wszystkie wywołania przez helper; `generateMetadata` używa helpera
      w opisie; opcje w akordeonie dostają `currency` strony przez props.
- [ ] Test jednostkowy helpera (vitest): USD/per_person, USD/flat, EUR/request, waluta nieznana.

## Gotowe, gdy
- [ ] `grep -rn "€" src --include=*.ts --include=*.tsx | grep -v "src/emails/" | grep -v format-price.ts` → 0 trafień.
- [ ] `grep -rn "function formatPrice" src` → wyłącznie `src/lib/format-price.ts`.
- [ ] Lokalnie, po zasianiu jednej strony testowej z `currency='USD'`, `price_type='flat'`, `price_from=550`:
      render `/experiences/<slug>` zawiera `from $550 per trip`, a `<meta name="description">` zawiera `From $550` —
      zrzut HTML w raporcie (`curl -s localhost:3000/experiences/<slug> | grep -o 'from \$550[^<]*'`).
- [ ] Ta sama strona na `/trips?country=<kraj>` pokazuje `$550`, nie `€550`.
- [ ] Testy helpera zielone; **czerwony dowód**: test z `currency: 'XXX'` oczekuje `XXX 550`, nie `€550`.
- [ ] Po zmianie danych na produkcji (STOP) — `curl -s https://fjordanglers.com/experiences/fly-fishing-bariloche-limay-manso | grep -o 'from [^<]*'`
      zwraca `$`, a nie `€`; to samo dla `fly-fishing-coyhaique-aysen`.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Ceny w mailach (`src/emails/*`) — mają własny kontekst oferty; osobne zadanie, jeśli wyjdzie z odczytu.
- Przeliczanie walut, kursy, `finance_settings`.
- Nowa kolumna z jednostką ceny („for two anglers") — jeśli okaże się potrzebna, to migracja i
  osobna decyzja; tutaj działamy na istniejących `currency` + `price_type`.
- Treść i copy stron (FA-0.12).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- **Dane na produkcji.** Jeśli odczyt pokaże `currency='EUR'` na stronach Argentyny/Chile/NZ albo
  `price_type='per_person'` przy cenie, która jest za dwóch (Leobono $550/$650 za 2), potrzebny jest
  `UPDATE experience_pages` na `uwxrstbplaoxfghrchcy`. **STOP**: pokaż dokładny `UPDATE ... WHERE slug IN (...)`
  i wynik SELECT-a przed, poczekaj na zgodę tj. Wykonanie — tj, nie agent (jak w FA-0.05).
- **Wording jednostki.** „per trip" vs „for two anglers" vs „for the group" — decyzja tj przed
  merge'em; agent nie wymyśla trzeciej wersji.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci ani z pliku typów.

## Weryfikacja
```
grep -rn "€" src --include=*.ts --include=*.tsx | grep -v "src/emails/" | grep -v format-price.ts   # oczekiwane: 0
grep -rn "function formatPrice" src                                                                # oczekiwane: tylko lib/format-price.ts
pnpm test -- --run src/lib/format-price.test.ts
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
curl -s https://fjordanglers.com/experiences/fly-fishing-bariloche-limay-manso | grep -o 'from [^<]*' | head -3   # po UPDATE: $
```

## Notatki z realizacji (2026-09-05)

Zakres poszerzony ponad plik zadania po odczycie kodu i decyzjach tj w trakcie sesji —
patrz „Needs a decision" niżej dla dwóch decyzji do potwierdzenia przed merge'em.

## Report — FA-0.11 Cena mówi prawdę: `formatPrice` z `currency` i jednostką

### Done

- **Odczyt bieżącego stanu (kod)** — trzy kopie z pliku zadania potwierdzone, plus 6 dodatkowych
  miejsc nieujętych w zadaniu, znalezionych grepem i odczytem: `src/app/experiences/[slug]/page.tsx:1581`
  (karta "More like this"), `src/app/trips/exp-page-map-view.tsx:313` (popup pinezki na mapie),
  `src/app/trips/filters.tsx:18-21` / `filters-modal.tsx:15-18` (kubełki filtra cen — inny problem,
  zostawione), `src/components/home/experiences-slider.tsx:95` (slider na stronie głównej),
  `src/app/(public)/guides/[id]/page.tsx:485` (profil przewodnika). Ostatnie dwa dołożone do zakresu
  na żądanie tj w trakcie sesji. Pełna lista przed zmianą — evidence:
  ```
  grep -rn "€" src --include=*.tsx --include=*.ts | wc -l   → 113 trafień, 40 plików
  ```
- **`src/lib/format-price.ts`** — `formatPrice({priceFrom, priceType, currency})`, mapa symboli
  `{EUR:'€', USD:'$', NZD:'NZ$', GBP:'£', SEK:'SEK ', NOK:'NOK ', ISK:'ISK '}`; nieznana waluta →
  `${currency} ` (kod ISO + spacja), nigdy `€`. Jednostki: `per_person` → `/ person`, `flat` →
  `per trip`, `request` → `Price on request`. Dodatkowo eksportuje `currencySymbol(currency)` —
  używany tam, gdzie istniejący layout już ma osobny label na jednostkę (booking widget) i pełny
  `formatPrice()` dublowałby tekst.
- **Martwa `formatPrice` w `src/lib/utils.ts` usunięta** — dowód nieużywania **przed** usunięciem:
  ```
  grep -rn "formatPrice" src | grep -v format-price
  → src/lib/utils.ts:8:export function formatPrice(amount: number, currency = 'EUR'): string {
  (jedyne trafienie — sama definicja, zero wywołań gdziekolwiek)
  ```
- **Czerwony dowód testu** — `src/lib/format-price.test.ts` napisany najpierw, potem
  `format-price.ts` tymczasowo podmieniony na stub odtwarzający dzisiejszy produkcyjny bug
  (zaszyty `€`, `currency` ignorowany), uruchomiony, przywrócona poprawna implementacja:
  ```
  # ze stubem (stary bug):
  ✗ USD / per_person   expected 'from €550 / person' to be 'from $550 / person'
  ✗ USD / flat         expected 'from €550 for the group' to be 'from $550 per trip'
  ✗ unknown currency   expected 'from €550 for the group' to contain 'XXX 550'
  ✓ EUR / request
  Test Files 1 failed (1) · Tests 3 failed | 1 passed (4)

  # z poprawną implementacją:
  ✓ src/lib/format-price.test.ts (4 tests)
  Test Files 1 passed (1) · Tests 4 passed (4)
  ```
- **Wszystkie kopie usunięte, wywołania przez helper** — `src/app/experiences/[slug]/page.tsx`
  (`generateMetadata` + 4 miejsca w treści), `src/components/trips/TripOptionsAccordion.tsx`
  (`OptionPanel`, `OptionModal`, lista akordeonu), `src/app/trips/exp-page-map-section.tsx`
  (`SheetCard`, `ExpCard`), `src/app/trips/exp-page-map-view.tsx` (popup), `src/components/home/experiences-slider.tsx`,
  `src/app/(public)/guides/[id]/page.tsx` (przez `currencySymbol`, layout z osobnym `/pp` zachowany
  bez zmian). `currency` dochodzi propsami — bez fallbacku na `'EUR'` w żadnym komponencie
  (`ExperienceTabLayout`, `TripOptionsAccordion`/`OptionPanel`/`OptionModal`,
  `ExperiencePageWithOptions` [martwy plik, 0 importerów poza sobą — zaktualizowany tylko żeby
  dalej się typował], `InquiryWidget`/`InquiryModal`/`MobileInquiryBar`) — `currency: string`
  wymagane wszędzie, bo kolumna ma `NOT NULL DEFAULT 'EUR'` w bazie.
- **Selecty uzupełnione o `currency`** (i `price_type` tam, gdzie brakowało): główny i 2×
  podobne strony w `experiences/[slug]/page.tsx`, `trips/page.tsx`, `trips/exp-page-geo-action.ts`,
  `getFeaturedExperiencePages`/`getGuideExperiencePages` w `src/lib/supabase/queries.ts`.
- **`generateMetadata`** — opis buduje przez `currencySymbol()`, zero `From €${...}` w literale.
- **Schema.org `priceCurrency`** — dwa miejsca hardkodowały `'EUR'` niezależnie od symbolu `€`
  (nie łapane przez grep po `€`, ta sama rodzina buga): `experiences/[slug]/page.tsx` `tripSchema`
  i `trips/page.tsx` `itemListSchema` — oba teraz czytają `page.currency`/`exp.currency`.
- **Band-aid usunięty** — `experiences/[slug]/page.tsx` (tryb flat, bez opcji) miał już
  `{page.currency !== 'EUR' && <p>Prices in {page.currency}</p>}` — obejście tego samego buga
  zamiast naprawy. Usunięte jako zbędne po naprawie źródła (cena sama pokazuje właściwy symbol).
- **Wording ujednolicony w obu miejscach** — `experiences/[slug]/page.tsx:1353` i
  `TripOptionsAccordion.tsx:307` miały identyczny tekst `'Flat rate for the group · includes
  guide service'`, sprzeczny z `'per trip'` w cenie nad nim. Zmienione na
  `'Flat rate per trip · includes guide service'` w obu miejscach — patrz „Needs a decision".
- **Grep — kryterium ostateczne (rozszerzone przez tj o `src/components/inquiry` i dwie strony
  publiczne)**:
  ```
  grep -rn "€" src/app/experiences src/app/trips src/components/trips \
    src/components/inquiry src/components/home/experiences-slider.tsx \
    "src/app/(public)/guides" --include=*.ts --include=*.tsx \
    | grep -v filters.tsx | grep -v filters-modal.tsx
  → 0 trafień
  ```
- **`grep -rn "function formatPrice" src`** → wyłącznie `src/lib/format-price.ts:22`.
- **Lokalnie, strona testowa `currency='USD', price_type='flat', price_from=550`** — zasiana
  bezpośrednio w lokalnej bazie (`experience_pages`, slug `fa-0-11-usd-test`), `pnpm dev`
  uruchomiony z env nadpisanym na lokalny stack (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421`
  + lokalne demo-klucze `anon`/`service_role` — nigdy testowy projekt z `.env.local`), serwer
  zatrzymany i wiersz testowy skasowany zaraz po sprawdzeniu:
  ```
  $ curl -s localhost:3000/experiences/fa-0-11-usd-test | grep -o 'from \$550[^<]*'
  from $550 per trip
  from $550 per trip
  from $550
  from $550 per trip...

  $ curl -s localhost:3000/experiences/fa-0-11-usd-test | grep -o '<meta name="description"[^>]*>'
  <meta name="description" content="Guided fishing in Test Region, Test Country. From $550. Book with a verified local guide via FjordAnglers."/>

  $ curl -s "localhost:3000/trips?country=Test%20Country" | grep -o '\$550[^<]*' | head -3
  $550 per trip
  $ curl -s "localhost:3000/trips?country=Test%20Country" | grep -c '€'
  0
  ```
- **`pnpm typecheck`** → `tsc --noEmit`, exit 0, 0 błędów.
- **`pnpm test -- --run`** → 4 pliki, **21 passed** (4 nowe w `format-price.test.ts` + 17 istniejące).
- **`pnpm build`** → exit 0, 46/46 stron, `runAfterProductionCompile` OK.
- **`pnpm lint`** — porównanie branch vs `main` (worktree z podlinkowanym `node_modules`, jak w
  FA-0.05): **identyczne po obu stronach — 100 problemów (40 błędów / 60 ostrzeżeń)**. Zero
  nowych błędów; ten branch nie dotyka żadnego z plików na liście istniejących błędów
  (maile, `image-crop.tsx`, `whatsapp-bridge/poll-emails.mjs`).
- Status `todo → review` w tym pliku i w `docs/tasks/INDEX.md`, w tym samym PR (commit osobny
  od poprzedzającego `docs: add task files FA-0.12–FA-0.16`, który wszedł na `main` przed
  otwarciem tej gałęzi, bo był niezwiązanym, nieskomitowanym stanem sprzed sesji).

### Not done

- **SELECT-y na produkcji (Argentyna/Chile/NZ)** — brak poświadczeń Supabase w tej sesji
  (`mcp__supabase` → `Unauthorized`, brak `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD`
  w env, ten sam stan co FA-0.05/FA-1.06). Dokładne zapytania z sekcji „Zakres" poniżej —
  wykonaj i wklej wynik przed decyzją o ewentualnym UPDATE-cie:
  ```sql
  select slug, country, currency, price_type, price_from, status
  from experience_pages
  where country in ('Argentina','Chile','New Zealand') order by country, slug;

  select ep.slug, o.label, o.price_from, o.price_type
  from experience_page_options o join experience_pages ep on ep.id = o.experience_page_id
  where ep.country in ('Argentina','Chile') order by 1,2;
  ```
  Jeśli `currency='EUR'` na stronach Patagonii/NZ albo `price_type='per_person'` przy cenie za
  dwóch — to bloker danych z sekcji „Bramki STOP" pliku zadania; przygotuję `UPDATE ... WHERE
  slug IN (...)` po zobaczeniu wyniku, wykonanie zostaje po twojej stronie.
- **Weryfikacja produkcji** (`curl fjordanglers.com/experiences/fly-fishing-bariloche-limay-manso`
  i `fly-fishing-coyhaique-aysen` → oczekiwane `$`, nie `€`) — zgodnie z punktem 10 uzupełnień:
  nie jest kryterium zamknięcia tego PR-a, zależy od UPDATE-u danych, który wykonujesz ty po
  akceptacji. Krok po deployu.

### Noticed, not touched (→ `docs/deferred-tasks.md`)

- `src/app/trips/filters.tsx:18-21`, `src/app/trips/filters-modal.tsx:15-18` — kubełki filtra
  ceny na `/trips` (`'Under €150'` itd.) hardkodują `€`, ale problem jest inny: `/trips` miesza
  waluty w jednej liście, więc kubełek nie ma jednoznacznej waluty. Wymaga decyzji produktowej,
  nie mechanicznej podmiany.
- `src/app/admin/experiences/page.tsx:113` — ten sam bug (`from €${row.price_from}`), ale w
  module admina, poza zakresem razem z resztą admina/ofert/maili.

### Needs a decision

1. **Wording „per trip"** — helper i oba miejsca z opisem drugorzędnym
   (`experiences/[slug]/page.tsx:1353`, `TripOptionsAccordion.tsx:307`) mówią teraz spójnie
   „Flat rate per trip"/„per trip", zgodnie z zadaniem. Widoczna zmiana dla użytkownika (było:
   „for the group"). Trzeciej wersji nie wymyślałem — do potwierdzenia przed merge'em.
2. **Produkcja Patagonia/NZ** — patrz „Not done" wyżej; potrzebuję SELECT-a z produkcji, żeby
   wiedzieć, czy trzeba przygotować `UPDATE`.

### Verification

```
$ grep -rn "€" src/app/experiences src/app/trips src/components/trips \
    src/components/inquiry src/components/home/experiences-slider.tsx \
    "src/app/(public)/guides" --include=*.ts --include=*.tsx \
    | grep -v filters.tsx | grep -v filters-modal.tsx
(0 hits)

$ grep -rn "function formatPrice" src
src/lib/format-price.ts:22:export function formatPrice({ priceFrom, priceType, currency }: FormatPriceInput): string {

$ pnpm vitest run src/lib/format-price.test.ts
✓ src/lib/format-price.test.ts (4 tests)

$ pnpm typecheck && pnpm test -- --run && pnpm build
tsc --noEmit → exit 0
Test Files 4 passed (4) · Tests 21 passed (21)
pnpm build → exit 0, 46/46 pages

$ pnpm lint   # branch
✖ 100 problems (40 errors, 60 warnings)
$ pnpm lint   # main (git worktree)
✖ 100 problems (40 errors, 60 warnings)
→ zero new errors

$ curl -s localhost:3000/experiences/fa-0-11-usd-test | grep -o 'from \$550[^<]*'
from $550 per trip

$ curl -s localhost:3000/experiences/fa-0-11-usd-test | grep -o '<meta name="description"[^>]*>'
<meta name="description" content="Guided fishing in Test Region, Test Country. From $550. Book with a verified local guide via FjordAnglers."/>

$ curl -s "localhost:3000/trips?country=Test%20Country" | grep -o '\$550[^<]*' | head -3
$550 per trip
```
