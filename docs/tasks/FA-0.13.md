---
id: FA-0.13
title: `estimateLeadValue(location)` — wartość konwersji per destynacja
stage: 0
status: review
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-core
branch: fix/lead-value-location
depends_on: [FA-0.12]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 2
owner: tj
---

# FA-0.13 — `estimateLeadValue(location)`

**Skąd to zadanie (audyt lejka 5 IX 2026).** Zapytanie z Patagonii dostaje dziś wartość konwersji
liczoną stawkami islandzkimi (1 dzień = 100 zł bazowo), a float 2–3 dni w Bariloche to $1 100–2 000
dla dwóch osób. Parametr `location` w `LeadValueParams` istnieje i jest ignorowany. Dopóki
licytacja jest ręczna, nie boli; w momencie przejścia na wartość konwersji Patagonia będzie
systematycznie niedolicytowana. Z lejka: zapytanie wielodniowe jest warte ~12× więcej niż jednodniowe.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`
- `src/lib/leadValue.ts` — `BASE_VALUES` (100/400/900/1600), `location?` nieużywany
- `src/lib/leadValue.test.ts` — obecne testy (wartości bazowe × min(osoby,4)/2)
- `src/components/inquiry/InquiryWidget.tsx:309` — jedyne wywołanie; sprawdź, czy widget ma dostęp
  do `country` strony (props / kontekst) — jeśli nie, przekaż z `app/experiences/[slug]/page.tsx`
- `docs/audit/` i artefakt „Lejek FjordAnglers" (5 IX) — skąd stawki
- `claude/patagonia-test-campaign-2026-09.md` (projekt Cowork) — stawki Patagonii: 1 dzień 150, 2–3 dni 600, 4–7 1 200, 7+ 2 000 zł

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Wartość konwersji wysyłana do Google Ads odzwierciedla realny bilet destynacji. Jedna tabela
stawek per grupa (Nordic / Patagonia / New Zealand), domyślna = obecna (Nordic), tak żeby
żadne istniejące wywołanie nie zmieniło wyniku bez `location`.

## Zakres
- [ ] **Odczyt bieżącego stanu**: otwórz `leadValue.ts`, test i wywołanie w widgecie; ustal, skąd widget
      może wziąć `country` (wklej fragment do raportu).
- [ ] `BASE_VALUES` → `Record<LocationGroup, Record<TripLength, number>>` z grupami `nordic` (obecne
      wartości), `patagonia` (150/600/1200/2000), `new_zealand` (do ustalenia — patrz STOP; do czasu
      decyzji = nordic). Mapa kraj → grupa w jednym miejscu (współdzielona z FA-0.12, jeśli tamto
      zadanie ją już założyło — nie dubluj).
- [ ] `estimateLeadValue({ tripLength, groupSize, location })` — `location` to kraj strony; brak → `nordic`.
- [ ] Widget przekazuje `country` strony.
- [ ] Testy: istniejące bez zmian wyniku; nowe dla `Argentina`, `Chile`, nieznanego kraju (→ nordic).

## Gotowe, gdy
- [ ] `pnpm test -- --run src/lib/leadValue.test.ts` zielone, w tym: `{tripLength:'2-3', groupSize:2, location:'Argentina'}` → `600`;
      `{tripLength:'1', groupSize:2}` (bez location) → `100` jak dziś.
- [ ] **Czerwony dowód**: test z `location: 'Atlantis'` oczekuje wartości nordic, nie `NaN`/`undefined`.
- [ ] Lokalnie: submit widgetu na stronie z `country='Chile'` wysyła do `gtag('event','conversion', {value: 600, …})`
      dla `2-3` i 2 osób — zrzut z Network albo `console` w raporcie.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Zmiana strategii licytacji w Google Ads — decyzja tj poza kodem.
- Import konwersji offline („Deposit paid") — etap 5.
- Cokolwiek w widgecie poza przekazaniem `country`.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Stawki NZ nie są ustalone — **nie wymyślaj**; do decyzji tj zostaw = nordic i wpisz to jawnie w raporcie.

## Weryfikacja
```
pnpm test -- --run src/lib/leadValue.test.ts
grep -n "estimateLeadValue(" -r src   # oczekiwane: widget przekazuje location
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji

**Poprawka `depends_on`**: plik miał `depends_on: []`, ale zadanie zakłada
`COUNTRY_REGION`/`getRegionGroup()` z FA-0.12. Zweryfikowane przed startem:
`git show main:src/lib/countries.ts | grep COUNTRY_REGION` — obecne w `main`. Ustawione
na `depends_on: [FA-0.12]` w tym PR.

## Report — FA-0.13 `estimateLeadValue(location)`

### Done
- `BASE_VALUES` w `src/lib/leadValue.ts` → `Record<RegionGroup, Record<TripLength, number>>`
  (typ `RegionGroup` importowany z `@/lib/countries`, żadna druga mapa kraj→grupa nie
  powstała). Nordic bez zmian (100/400/900/1600), Patagonia 150/600/1200/2000,
  `'New Zealand'` = wartości Nordic — patrz "Needs a decision".
- `estimateLeadValue({ tripLength, groupSize, location })`: `location` → `getRegionGroup()`
  → grupa; brak/nieznany kraj → `DEFAULT_GROUP = 'Nordic'`. Zero `as`, zero `!`.
- Widget: `country` przewleczony tą samą ścieżką co `currency` (FA-0.11):
  `experiences/[slug]/page.tsx` → `ExperienceTabLayout` / `InquiryWidget` (flat branch) →
  `InquiryModal` → `estimateLeadValue({ ..., location: country })`. Też dociągnięty do
  `ExperiencePageWithOptions.tsx` (nieużywany nigdzie w drzewie importów — martwy kod,
  ale ma tę samą sygnaturę `InquiryWidget`, więc bez tego `pnpm typecheck` by nie przeszedł).
- Wszystkie 4 istniejące asercje w `leadValue.test.ts` nietknięte i zielone, w tym linia 36
  (`location: 'Norway'` → 900 — dziś przechodzi bo `location` ignorowany, po zmianie
  przechodzi bo Norway → Nordic → 900, wynik identyczny).
- 4 nowe testy: Argentina 2-3/2 → 600, Chile 4-7/2 → 1200, New Zealand 2-3/2 → 400
  (= Nordic), `location: 'Atlantis'` (nieznany kraj) → 900, nie `NaN`/`undefined`/throw.
- Status `todo → review` tu i w `INDEX.md`.

### Not done
— (nic z zakresu pominięte)

### Noticed, not touched (→ docs/deferred-tasks.md)
- `src/components/trips/ExperiencePageWithOptions.tsx` nie jest importowany nigdzie poza
  sobą i `TripOptionsAccordion.tsx` (typ), czyli jest martwym kodem sprzed refaktoru na
  `ExperienceTabLayout`. Nie usunięty w tym PR — nie jest to zadanie, które go zastępuje
  (reguła 9 z CLAUDE.md), i nie było w zakresie. Dopisane do `docs/deferred-tasks.md`.

### Needs a decision
- **Stawki New Zealand nie są ustalone.** Zgodnie z bramką STOP zostawione = Nordic
  (100/400/900/1600), jawnie skomentowane w `BASE_VALUES` i pokryte testem
  (`New Zealand, 2-3 days, 2 anglers → 400`). Czeka na decyzję tj, nie interpolowane.

### Verification

**Czerwony dowód** (przed dodaniem fallbacku `?? DEFAULT_GROUP`, tymczasowo usunięty z kodu,
testy odpalone, potem przywrócony):
```
$ pnpm test -- --run src/lib/leadValue.test.ts
 FAIL  src/lib/leadValue.test.ts > ... > 7+ days → 1600
 TypeError: Cannot read properties of undefined (reading '7+')
   ❯ estimateLeadValue src/lib/leadValue.ts:44:39
 FAIL  ... > unknown location "Atlantis" falls back to Nordic, not NaN/undefined/throw
 TypeError: Cannot read properties of undefined (reading '4-7')
 Test Files  1 failed | 3 passed (4)
      Tests  10 failed | 15 passed (25)
```
Po przywróceniu `?? DEFAULT_GROUP`:
```
$ pnpm test -- --run src/lib/leadValue.test.ts
 ✓ src/lib/leadValue.test.ts (14 tests) 3ms
 Test Files  1 passed (1)
      Tests  14 passed (14)
```

**Grep — widget przekazuje `location`:**
```
$ grep -n "estimateLeadValue(" -r src
src/components/inquiry/InquiryWidget.tsx:317:      const leadValue = estimateLeadValue({
...
src/lib/leadValue.ts:42:export function estimateLeadValue({ tripLength, groupSize, location }: LeadValueParams): number {
```
```ts
// src/components/inquiry/InquiryWidget.tsx:317-321
const leadValue = estimateLeadValue({
  tripLength: tripLength as TripLength,
  groupSize:  partySize,
  location:   country,
})
```

**Lokalnie — gtag conversion, country='Chile', 2-3 dni, 2 osoby** (local Supabase stack,
`pnpm dev` z env override na `http://127.0.0.1:54421` — nigdy `.env.local`; jednorazowa
zgoda tj na zapis/odczyt w lokalnej bazie tylko na potrzeby tego sprawdzenia, bo realny
submit wymaga `res.ok` z `/api/inquiries`, co jest w konflikcie z `touches_db: false` —
zgłoszone i zatwierdzone przed wykonaniem). Tymczasowy wiersz `experience_pages`
(`country='Chile'`, usunięty po teście razem z utworzonym inquiry). Playwright: otwarcie
`/experiences/fa-0-13-test-chile`, spy na `window.gtag`, "Send Inquiry" → "Discuss dates
later" → formularz: 2 anglerów, trip length "2–3 days" → Send:
```json
[
  ["event","form_start",{"form_id":"inquiry_modal","form_name":"Trip Inquiry"}],
  ["event","conversion",{"send_to":"AW-18171634204/yydcCKmuoe0cEJzE9NhD","value":600,"currency":"PLN"}],
  ["event","SUBMIT_LEAD_FORM",{"send_to":"G-Z3Y8GMHR4J","value":600,"currency":"PLN","trip_name":"FA-0.13 Test Trip Chile"}]
]
```
`value: 600` = Patagonia rate for 2-3 days × 2 anglers, exactly as specified. Test row and
its inquiry deleted afterward; `select count(*) from experience_pages; select count(*) from
inquiries;` → both 0, local DB back to empty.

**Full suite:**
```
$ pnpm typecheck && pnpm test -- --run && pnpm build
tsc --noEmit                     → 0 errors
Test Files  4 passed (4) / Tests 25 passed (25)
pnpm build                       → compiled successfully, all routes generated
```

**Lint — no new errors vs main:**
```
$ pnpm lint
✖ 100 problems (40 errors, 60 warnings)
```
Identical to the known `main` baseline (FA-0.05/FA-1.06 established this number); no new
errors introduced by this change.
