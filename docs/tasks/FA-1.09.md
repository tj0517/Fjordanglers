---
id: FA-1.09
title: Gorące akcje na `experience_pages` — tytuł, slug, cena i przewodnik wyprawy z `experience_page_id`, nie z `trip_id`
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: feat/inquiry-experience-page-lookup
depends_on: [FA-1.06]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.09 — Gorące akcje na `experience_pages`

**Zawężone 5 IX 2026 (decyzja tj po FA-1.06).** Pierwotny tytuł brzmiał „Legacy edytor
`experiences` poza nawigacją; gorące akcje na `experience_pages`". Pierwsza połowa straciła
przedmiot — FA-1.06 usunęło edytor w całości (D1). Zostaje druga połowa, czyli punkt 7 etapu 1
w `docs/REBUILD_PLAN.md` §8: *„cztery gorące akcje w `inquiries.ts` i webhook depozytu
przepięte na `experience_pages`"*. FA-1.06 wycięło te odwołania (D2 opcja A) i zostawiło
fallback `'Your trip'` / `'—'`; to zadanie daje im prawdziwe dane.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły 3 (warstwa danych) i 8 (`as any`)
- `docs/03-conventions.md` — konwencje kodu
- `docs/tasks/FA-1.06.md` — tabela fazy A, pozycje b3, b5, b6, b7, b10, b11, b16, b17 i
  „Decyzja D2"; sekcja „Not done" (czego nie odczytano z produkcji)
- `docs/deferred-tasks.md` — dwa wiersze FA-1.06: „8 miejsc …" i „`InquiriesClient` /
  `InquiriesCalendar` przyjmują puste mapy"
- `docs/02-data-model.md` §1 („Archived in FA-1.01") i §3 (`experiences.max_guests →
  experience_pages.max_guests via trip_id`)
- `docs/05-agent-operations.md` §4 i §7 — odczyt produkcji, sekrety
- `src/lib/ai/inquiry-agent.ts` ok. linii 500 — jedyne miejsce, które już dziś czyta tytuł
  z `experience_pages` po `experience_page_id`; wzorzec do uogólnienia
- `src/lib/inquiries/create.ts` (po merge FA-0.05) — jak nowe zapytania dostają
  `experience_page_id` vs `trip_id`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Każde miejsce, które potrzebuje nazwy, sluga, ceny wyjściowej albo przewodnika wyprawy dla
zapytania, dostaje je z jednego helpera w warstwie danych, zasilanego z `experience_pages`.
Maile, nazwy produktów w Stripe, lista i karta zapytania w adminie, dashboard przewodnika,
agent AI i strona recenzji przestają pokazywać `'Your trip'`.

## Zakres
- [ ] **Odczyt bieżącego stanu produkcji (SELECT, hasło ustawione świadomie na jedno
      polecenie, wynik w raporcie):**
      ```sql
      select count(*) filter (where trip_id is not null)             as with_trip_id,
             count(*) filter (where experience_page_id is not null)  as with_page_id,
             count(*) filter (where trip_id is null and experience_page_id is null) as neither,
             count(*) filter (where trip_id is not null and exists
               (select 1 from experience_pages p where p.trip_id = inquiries.trip_id)) as trip_id_resolvable
      from inquiries;
      select count(*), count(*) filter (where trip_id is not null) from experience_pages;
      ```
      Te liczby decydują, czy fallback `trip_id → experience_pages.trip_id` jest potrzebny,
      czy wystarczy `experience_page_id`.
- [ ] Helper w warstwie danych (`src/lib/inquiries/experience-lookup.ts` albo obok
      `create.ts`): `getInquiryExperience(inquiry: { experience_page_id, trip_id })` →
      `{ id, name, slug, guideId, priceFrom } | null`. Kolejność: `experience_page_id`, potem
      `experience_pages.trip_id = trip_id`. Bez `as any`. Jeden test jednostkowy na kolejność
      rozwiązywania.
- [ ] Przepięcie 8 miejsc z tabeli FA-1.06 (b3 ×7 w `src/actions/inquiries.ts`, b5
      `reviews.ts`, b6 `ai.ts`, b7 `inquiry-agent.ts`, b10 `admin/inquiries/page.tsx`, b11
      `admin/inquiries/[id]/page.tsx`, b16 `api/webhooks/stripe-deposit`, b17
      `dashboard/trips/page.tsx`) na helper. `sendDepositLink`: przywrócić wyliczenie
      depozytu z `price_from × party_size` jako fallback, gdy `offer_deposit_eur` puste.
- [ ] `InquiriesClient.tsx` / `InquiriesCalendar.tsx`: `tripMap`/`slugMap`/`countryMap`
      zasilone z helpera (lub z jednego zapytania `experience_pages` po zebranych id)
      zamiast pustych obiektów.
- [ ] `sendRichOfferAnglerEmail` i strona `/offers/[token]`: nazwa przewodnika z
      `assigned_guide_id`, a gdy brak — z `experience_pages.guide_id` przez helper.

## Gotowe, gdy
- [ ] `grep -rn "'Your trip'" src` → tylko fallbacki wewnątrz helpera / szablonów, żadnych
      literałów w akcjach i stronach (lista pozostałych z uzasadnieniem w raporcie).
- [ ] Odczyt produkcji z zakresu wklejony do raportu; decyzja o fallbacku `trip_id`
      uzasadniona tymi liczbami.
- [ ] Test jednostkowy helpera zielony; `pnpm test -- --run` ≥ 18 testów.
- [ ] `pnpm typecheck` 0, `pnpm build` przechodzi, `pnpm lint` nie gorzej niż na `main`.
- [ ] Czerwony dowód: helper wywołany z `{ experience_page_id: null, trip_id: null }` zwraca
      `null`, a nie rzuca — pokazany testem.
- [ ] Wiersze FA-1.06 „8 miejsc …" i „puste mapy” w `docs/deferred-tasks.md` zamknięte.

## Poza zakresem
- `experience_pages.max_guests` (kolumny nie ma; mapowanie `experiences.max_guests` to
  etap 4, `02-data-model.md` §3) — `InquiryWidget` zostaje przy domyślnych 12.
- Backfill `inquiries.experience_page_id` z `trip_id` w bazie — to migracja danych, etap 4.
- Rename `experience_pages → experiences` — O-04.
- Usuwanie `as any` w `inquiries.ts` (kolumny `Json`) — osobne zadanie z
  `docs/deferred-tasks.md`.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Jakikolwiek zapis na produkcji `uwxrstbplaoxfghrchcy` — STOP. Zakres to wyłącznie SELECT.
- `SUPABASE_DB_PASSWORD` ustawiane per polecenie, nigdy wypisywane (`test -n`), nie w
  plikach repo.

## Weryfikacja
```
pnpm typecheck && pnpm build && pnpm test -- --run
grep -rn "'Your trip'" src
pnpm lint   # liczba błędów vs main
```

## Notatki z realizacji

## Report — FA-1.09 Gorące akcje na `experience_pages`

**Branch:** `feat/inquiry-experience-page-lookup` z `origin/stage-1` @ `7d444b4` (zawiera PR #66) · **Zadanie:** `docs/tasks/FA-1.09.md`
**Model:** Sonnet 5, effort medium-high (M, zgoda niepotrzebna). Implementację wykonał subagent `fa-core` wg briefu tj (zapisanego w pliku); diff przeczytałem całą, a weryfikację i wszystkie czerwone dowody powtórzyłem osobno (patrz „Verification").
`touches_db: false` — brak migracji, brak zapisu na produkcji, brak połączenia z bazą z mojej strony (próba `execute_sql` przez MCP → `You do not have permission`).

### Odczyt produkcji — wykonał **tj**, Supabase SQL Editor, 20 IX 2026 (nie powtarzany przez agenta)

`inquiries` — 99 wierszy:

| with_trip_id | with_page_id | neither | trip_id_resolvable |
|---:|---:|---:|---:|
| 74 | 24 | 1 | 74 |

`experience_pages`: pages_total = 29 · pages_with_trip_id = 14 · duplikaty `trip_id` (`group by trip_id having count(*) > 1`) → 0 wierszy · `inquiries.trip_country` wypełnione w 98 z 99.

`price_type / currency` na **zapytaniach** (join po `experience_page_id` lub `trip_id`), 98 z 99:

| per_person/EUR | flat/NZD | flat/EUR | request/EUR | flat/USD |
|---:|---:|---:|---:|---:|
| 63 | 15 | 12 | 6 | 2 |

(Na stronach: flat/EUR 9 · request/USD 5 · per_person/EUR 4 · flat/USD 3 · request/EUR 3 · per_person/USD 2 · flat/NZD 2 · per_person/NZD 1.)

**Wnioski z tych liczb**
- **Fallback `trip_id` jest obowiązkowy.** Zbiory są rozłączne (74 + 24 + 1 = 99) i wszystkie 74 wiersze z `trip_id` rozwiązują się do `experience_pages`. Helper tylko po `experience_page_id` obsłużyłby 24 z 99 zapytań. Kolejność: `experience_page_id`, potem `experience_pages.trip_id`.
- **`experience_pages.trip_id` nie ma constraintu UNIQUE** — zero duplikatów to dziś fakt, nie gwarancja; dlatego gałąź `trip_id` używa `.order('created_at').limit(1).maybeSingle()`, nigdy `.single()`.
- **Pokrycie fallbacku depozytu (liczone na zapytaniach, nie na stronach):** EUR + (per_person lub flat) = 63 + 12 = 75 z 98 (77%); sam per_person dałby 63 z 98 (64%). Pozostałe 23 z 98 (flat/NZD 15, request/EUR 6, flat/USD 2) dostają błąd „No offer deposit set" i wymagają ręcznej oferty — patrz `docs/deferred-tasks.md`.

### Done
- **Helper `src/lib/inquiries/experience-lookup.ts`** — `getInquiryExperience({ experience_page_id, trip_id })` → `{ id, name, slug, country, guideId, priceFrom, priceType, currency } | null` oraz batch `getInquiryExperiences(rows)` (jedno zapytanie `.or('id.in.(…),trip_id.in.(…)')`, wynik kluczowany id zapytania). Bez `as any`, bez `'use server'`, nigdy nie rzuca (błąd bazy → log + `null`/pusta mapa). Evidence: 14 testów w `experience-lookup.test.ts` (kolejność rozwiązywania, batch: jedno zapytanie / page-id wygrywa z trip_id / pusty input bez zapytania, błąd bazy → null).
- **Fallback depozytu — funkcja czysta `src/lib/inquiries/deposit-fallback.ts`** `computeFallbackDepositCents(exp, partySize, depositPercent)`; kontrola `priceType` i `currency` **przed** liczeniem kwoty. per_person EUR: `price_from × party_size × depositPercent / 100`; flat EUR: `price_from × depositPercent / 100` (bez `party_size`); `request` → błąd; waluta ≠ EUR → błąd (bez przeliczania); kwota w centach (integer). Evidence: 13 testów (c) per_person 200 × 3 × 30% = 18000 ¢, (d) flat 1500 × 30% = 45000 ¢ przy party 4, (e), (f) — czerwone dowody poniżej.
- **`sendDepositLink`** — `offer_deposit_eur > 0` wygrywa zawsze; tylko gdy puste → fallback; `!fallback.ok` → `{ success: false }` przed Stripe; zostaje guard `< 50` ¢. Nazwa produktu Stripe i mail dostają nazwę wyprawy. Evidence: `sendDepositLink.test.ts` (6): oferta wygrywa z ceną `request`, per_person → 18000, flat → 45000, request / NZD / nierozwiązana wyprawa → odmowa i `stripe.checkout.sessions.create` nie wołane.
- **Webhook `stripe-deposit`** — tylko `tripTitle` z helpera (po zapisie płatności; helper nie rzuca). Idempotencja, `transition`, zdarzenia, przewodnik i treść maili bez zmian. Evidence: istniejące testy przeszły bez zmian + 2 nowe (nazwa trafia do maila wędkarza i FA; nierozwiązana → `'Your trip'`, status 200).
- **Przepięte miejsca (lista zamknięta z briefu):**
  - `src/actions/inquiries.ts`: `sendDepositLink` (nazwa w Stripe/mailu), `saveRichOffer`, `getOfferByToken`, `submitOfferAnswers` (nazwa produktu Stripe na paragonie: `Refundable Deposit — <nazwa>`), `sendMessageToAngler`, `sendOfferEmail`, `getInquiryConfirmation`.
  - Nazwa przewodnika w `saveRichOffer` / `sendOfferEmail` / `getOfferByToken`: `assigned_guide_id`, a gdy brak wiersza — `experience_pages.guide_id` z helpera; `'Your guide'` tylko jako ostatni fallback (`resolveOfferGuide`, nieeksportowana, bo plik jest `'use server'`).
  - `src/app/api/webhooks/stripe-deposit/route.ts`; `src/actions/reviews.ts`; `src/actions/ai.ts`; `src/lib/ai/inquiry-agent.ts` (round 2 — gałąź `trip_id`; reszta pliku bez zmian).
  - `src/app/admin/inquiries/[id]/page.tsx` — `tripTitle` / `tripLocationCountry` z helpera (koniec „na sztywno `null`").
  - `src/app/admin/inquiries/page.tsx` — `tripMap` / `slugMap` / `countryMap` z **jednego** wywołania `getInquiryExperiences`; `InquiriesClient.tsx` / `InquiriesCalendar.tsx` — tylko zmiana klucza wyszukiwania (patrz „Needs a decision" 1); propsy i filtry nietknięte (FA-1.08).
  - `src/app/dashboard/trips/page.tsx` — jedna linia z nazwą wyprawy pod nazwiskiem wędkarza przez batch helper; nic więcej w pliku.
- **`docs/deferred-tasks.md`** — zamknięte wiersze FA-1.06 „8 miejsc …" i „puste mapy"; dopisany wiersz tj o walutach + 6 wierszy z tego zadania.

### Pozostałe `Your trip` / `Your guide` (`grep -rn "Your trip\|Your Trip\|your trip" src`) — z uzasadnieniem
Fallbacki tytułu:
- `src/lib/inquiries/experience-lookup.ts:35` `TRIP_TITLE_FALLBACK = 'Your trip'` (i `GUIDE_NAME_FALLBACK = 'Your guide'`) — **jedyne** miejsce z literałem-fallbackiem w kodzie produkcyjnym; oryginał zadania dopuszcza „fallbacki wewnątrz helpera". To pozycja spoza listy „zostaje" z briefu — patrz „Needs a decision" 2.
- `src/app/admin/inquiries/[id]/ProposalTab.tsx:264` `experienceTitle ?? 'Your trip'` — ostatni fallback prezentacyjny (z briefu).
- `src/app/api/webhooks/__tests__/stripe-deposit.test.ts:311` — asercja testu na fallback.

Etykiety, nagłówki i copy (nie fallbacki tytułu):
- `InquiryWidget.tsx:699` (etykieta pola; z briefu), nagłówki maili: `booking-confirmed-angler.tsx:67`, `inquiry-offer-angler.tsx:38`, `inquiry-request-angler.tsx:107`, `deposit-confirmed-angler.tsx:27` (treść stała wokół `{tripTitle}`).
- Copy statyczne: `dashboard/page.tsx:125` („Your trips" — nagłówek listy), `reviews/[token]/page.tsx:5,36` i `ReviewForm.tsx:95,102` („Rate your trip"), `hero-search.tsx:52`, `home-faq.tsx:16`, `auth-tabs.tsx:60`, `dashboard/account/page.tsx:100`, `profile-edit-form.tsx:479,596`, `InquiryWidget.tsx:617`, `inquiry-agent.ts:294` (`CLOSING_MESSAGE`), `blog-data.ts:17`, `norway-regulations-2026.tsx:27,185`.
- `offers/[token]/page.tsx:357` — etykieta „Your guide" nad nazwą przewodnika (z briefu; nie pojawia się w grepie o `trip`).

### Not done
- **`getInquiryConfirmation.test.ts` i `inquiryStatusDefault.test.ts` nie zostały wykonane** — to testy integracyjne wymagające lokalnego stacku Supabase (`127.0.0.1:54421`, `ECONNREFUSED`); padają identycznie na gałęzi bazowej. Stack FA nie był uruchamiany (brief). `getInquiryConfirmation` zmieniona w tym PR, więc jej zachowanie z prawdziwą bazą jest **niezweryfikowane**; test jednostkowy tej funkcji nie istnieje.
- **Filtr `.or()` w `getInquiryExperiences` niezweryfikowany na prawdziwym PostgREST** — testy mockują klienta. Weryfikacja po deployu (checklista niżej).
- **Skrypty `pnpm` nie były uruchamiane** (patrz „Noticed" — `ERR_PNPM_IGNORED_BUILDS`); użyłem tych samych binariów bezpośrednio: `tsc --noEmit` (= `typecheck`), `eslint` (= `lint`), `vitest --run` (= `test`), `next build` (= `build`, z `NODE_OPTIONS=--max-old-space-size=3072`, przy chodzącym cudzym stacku Supabase, ~7,8 GB wolnego RAM).
- **Ścieżka po deployu** — nic w tym PR nie było uruchomione na produkcji ani na bazie z danymi.

### Noticed, not touched (→ docs/deferred-tasks.md, 6 wierszy)
- Klucze idempotencji Stripe z `Date.now()` — `sendDepositLink`, `submitOfferAnswers`.
- Mail depozytu drukuje `depositPercent` także gdy kwota pochodzi z `offer_deposit_eur`.
- `InquiriesCalendar` linkuje do nieistniejącej trasy `/trips/${trip_id}` (FA-1.08).
- Trzy strony wołają `.from()` bezpośrednio (reguła 3; etap 2).
- Filtr `.or()` niezweryfikowany na żywym PostgREST.
- `pnpm` 12.4.2 + `ERR_PNPM_IGNORED_BUILDS` i brudzenie `pnpm-workspace.yaml`.
- Poza deferred: `metadata.trip_id: inquiry.trip_id` w sesjach Stripe jest `null` dla 24 zapytań z samym `experience_page_id` (webhook czyta `inquiry_id`, więc bez skutku dziś) — zostawione zgodnie z briefem.

### Needs a decision
1. **Klucz map w `/admin/inquiries` = id zapytania.** Brief mówi „zasil batch helperem"; nie rozstrzyga klucza. Mapy kluczowane `trip_id` zostawiłyby `—` przy 24 z 99 zapytań (tylko `experience_page_id`, `trip_id = null`), więc `tripMap`/`slugMap`/`countryMap` są kluczowane `row.id`, a w `InquiriesClient` (1 miejsce) i `InquiriesCalendar` (5 miejsc) zmienił się wyłącznie klucz odczytu. Alternatywa: klucz `trip_id ?? experience_page_id`. Rekomendacja: zostawić (mniej kodu, brak kolizji przestrzeni id). Odwracalne w 6 liniach — proszę o weto, jeśli niepożądane.
2. **Stałe `TRIP_TITLE_FALLBACK` / `GUIDE_NAME_FALLBACK` w module helpera** — żeby `grep` pokazywał tylko listę „zostaje", literały weszły do jednego miejsca zamiast do każdego callera. To nowa pozycja w wynikach grepa (poza listą z briefu). Rekomendacja: zostawić.
3. **Cena bazowa.** Fallback liczy depozyt od `experience_pages.price_from` (cena „od"), a nie od wyceny konkretnej oferty — dla wypraw z opcjami może dać kwotę niższą niż rzeczywista. To wynika z decyzji tj (D2+D4); odnotowane, nie do zmiany w tym PR.
4. **Kosmetyka (tylko przy nierozwiązanej wyprawie, dziś 1 z 99 zapytań):** `runAgentRound2` przekazuje `tripTitle` do `sendInquiryAgentEmail`, którego temat to `Quick question about your ${tripTitle} inquiry` (`src/lib/email.ts:481`). Fallback zmienił się z `'your trip'` na `'Your trip'`, czyli temat z `your your trip inquiry` na `your Your trip inquiry` — obie wersje są niezgrabne, wada istniała przed zadaniem. Żaden test tego nie przypina. Poprawka = mail nie powinien składać zdania z fallbackiem (poza zakresem).

### Do sprawdzenia po deployu (tj)
- [ ] `/admin/inquiries` — lista pokazuje nazwy wypraw (nie `—`) dla zapytań z samym `trip_id` **i** z samym `experience_page_id`; filtr kraju w kalendarzu niepusty.
- [ ] Karta zapytania z `trip_id` (np. jedno z 74) — wiersz „Trip" i lista przewodników z kraju wyprawy.
- [ ] `/dashboard/trips` (konto przewodnika z przypisanymi zapytaniami) — linia z nazwą wyprawy pod nazwiskiem.
- [ ] `/offers/[token]` dla zapytania bez `assigned_guide_id` — nazwa przewodnika z `experience_pages.guide_id` (jeśli ustawione).
- [ ] `sendDepositLink` na zapytaniu bez `offer_deposit_eur`: per_person/EUR → kwota = cena × osoby × %; `flat`/NZD → „No offer deposit set — trip price is in NZD …". Test w trybie testowym Stripe.

### Verification
Wszystko uruchomione na gałęzi, wyniki własne (drugie, niezależne od subagenta):

```
$ ./node_modules/.bin/tsc --noEmit ; echo "tsc exit=$?"
tsc exit=0                                     # baza: 0 błędów

$ ./node_modules/.bin/vitest --run
 Test Files  2 failed | 20 passed (22)
      Tests  1 failed | 188 passed | 2 skipped (191)
# baza (origin/stage-1):  19 plików / 156 testów = 153 passed, 1 failed, 2 skipped
# +3 pliki, +35 testów (14 experience-lookup, 13 deposit-fallback, 6 sendDepositLink, 2 stripe-deposit), wszystkie zielone.
# Obie porażki identyczne jak w bazie i tylko one: ECONNREFUSED 127.0.0.1:54421
#   FAIL src/actions/__tests__/inquiryStatusDefault.test.ts > … INSERT without status uses the default and returns new
#   FAIL src/actions/getInquiryConfirmation.test.ts  (suite: Failed to insert test inquiry … ECONNREFUSED)

$ ./node_modules/.bin/eslint
✖ 117 problems (40 errors, 77 warnings)        # baza: ✖ 117 problems (40 errors, 77 warnings) — bez zmian

$ NODE_OPTIONS=--max-old-space-size=3072 ./node_modules/.bin/next build
✓ Compiled successfully in 35.2s
✓ Generating static pages using 5 workers (49/49) in 1886.3ms
build exit=0

$ git diff origin/stage-1..HEAD -U0 -- src | grep '^+' | grep -c "as any"        →  0
$ git diff origin/stage-1..HEAD -U0 -- src | grep '^+' | grep -c "update({ *status" →  0
```

**Czerwone dowody** (każdy: celowo zepsuta kopia kodu → test czerwony → `git checkout` → zielono; drzewo czyste po wszystkim, 77/77 zielonych w 6 plikach):

```
(b) helper rzuca dla { experience_page_id: null, trip_id: null }   [mutacja: wczesny return null → throw]
 FAIL src/lib/inquiries/__tests__/experience-lookup.test.ts > getInquiryExperience — red proof: nothing to resolve
      > returns null, does not throw and does not hit the database when both refs are null
AssertionError: promise rejected "Error: no reference" instead of resolving
      Tests  1 failed | 13 passed (14)

(e) price_type='request' zwraca kwotę   [mutacja: gałąź request i gałąź „unsupported type" wyłączone]
 FAIL … deposit-fallback.test.ts > red proof: refuses instead of guessing > price on request returns an error and no amount
AssertionError: expected true to be false // Object.is equality
      Tests  2 failed | 11 passed (13)

(f) waluta NZD/USD zwraca kwotę   [mutacja: sprawdzenie currency !== 'EUR' wyłączone]
 FAIL … > NZD price returns an error and no amount (never converted)
 FAIL … > USD price returns an error and no amount (never converted)
AssertionError: expected true to be false // Object.is equality
      Tests  2 failed | 11 passed (13)

(g) sendDepositLink ignoruje odmowę i woła Stripe   [mutacja: „if (!fallback.ok) return" usunięte]
 FAIL src/actions/__tests__/sendDepositLink.test.ts > red proof: nothing reaches Stripe on a bad price
      > price on request and no offer deposit: refused, Stripe not called      → expected true to be false
      > NZD price and no offer deposit: refused, Stripe not called             → expected { success: true, … } to match object { success: false }
      > experience unresolved and no offer deposit: refused, Stripe not called → expected { success: true, … } to deeply equal { success: false, … }
      Tests  3 failed | 3 passed (6)
```

Uwaga do (e): usunięcie **samej** gałęzi `request` nie wywala testu, bo „unsupported price type" łapie `request` z tym samym skutkiem (błąd, brak kwoty); dlatego mutacja wyłącza obie. Jawna gałąź zostaje dla czytelniejszego komunikatu.

**Rozbieżność ścieżki w briefie:** `src/lib/format/price.ts` nie istnieje — `formatPrice` jest w `src/lib/format-price.ts`. Helper zwraca `priceType`/`currency`, więc callerzy mogą go użyć bez drugiego zapytania; w tym PR żaden nowy ekran nie wyświetla ceny.

Przegląd tj 20 IX 2026: kryteria 1, 2, 5, 6 udowodnione; typecheck i lint powtórzone niezależnie (117 problemów, zgodnie z bazą); kryterium 3 (przebieg testów) przyjęte jako zadeklarowane — powłoka przeglądu to arm64, node_modules pod inną architekturę. Status done nadany świadomie mimo jednego kryterium zadeklarowanego.
