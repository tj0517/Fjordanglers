---
id: FA-1.10
title: Tymczasowy przegląd tygodniowy w obecnym `/admin` — 8 liczb z dzisiejszych tabel, do wyrzucenia w etapie 6
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: feat/admin-weekly-review
depends_on: [FA-1.04, FA-1.05]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.10 — Przegląd tygodniowy (wersja brzydka, świadomie tymczasowa)

## Kontekst — przeczytaj przed startem
- `docs/REBUILD_PLAN.md` §9 „Dorzucić jeden ekran, brzydki" — **to jest to zadanie**; §7 tabele
  metryk (M1, M2, M5, M6, M7, powody przegranych) — definicje i cele; §6 — docelowy ekran
  „Przegląd tygodniowy" (etap 6), którego ten zastępuje
- `docs/01-architecture.md` §5 (pieniądze — dziś `NUMERIC` EUR, jeden kurs) i §6 (warstwa metryk
  — docelowo widoki; **tu liczymy w TypeScript świadomie, bo ekran jest tymczasowy**)
- `docs/02-data-model.md` „Known wrong-but-live" — formuła przychodu
  `offer_deposit_eur ?? deposit_amount ?? internal_commission_eur`
- `src/app/admin/finances/page.tsx` (~96–160) — dzisiejsze liczenie przychodu po miesiącach i
  kurs z `finance_settings` (`eur_pln_rate`, `usd_eur_rate`); `src/actions/finances.ts`
- `src/app/admin/ads/page.tsx` (~22–30, ~147) — `ad_campaigns.spend` (waluta? sprawdź w
  `src/lib/google-ads` i `api/cron/sync-google-ads`), dzisiejszy „spend ÷ inquiries"
- `src/lib/periods.ts`, `src/lib/business-days.ts`, `src/lib/fx.ts`, `src/lib/leadValue.ts` —
  istniejące helpery; nie dubluj
- `src/lib/inquiries/qualified.ts` (FA-1.04) — `qualified ∈ {yes,no,unknown}`;
  `docs/tasks/FA-1.04.md` — kryteria 1 i 4 odroczone **do tego zadania**; wiersze FA-1.04 w
  `deferred-tasks.md` (seed, deduplikacja zdarzeń — M5/M6 liczyć z kolumny, nie ze zdarzeń)
- `supabase/migrations/20260910111336_inquiries_lost_reason_code.sql` — siedem kodów przegranych
- `supabase/migrations/20260904210532_inquiries_source_utm.sql` — `source`, `utm`, `gclid`
  (atrybucja kanału dla M6)
- `src/app/admin/layout.tsx` — sidenav
- `supabase/seed.sql` — wpis FA-1.12 w `deferred-tasks.md` (UUID z wersją `0`) — do naprawy tu,
  bo bez seeda nie da się udowodnić liczb lokalnie

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Cotygodniowy przegląd ma się zacząć teraz, nie po etapie 6. Jedna strona `/admin/weekly`
pokazuje osiem liczb policzonych z dzisiejszych tabel, każda z definicją pod spodem i linkiem
do listy rekordów, z których wynika. Ekran zostanie wyrzucony w etapie 6 — nie inwestujemy
w wygląd, inwestujemy w **poprawność formuł** (testy) i w to, żeby `/admin/finances` i ten
ekran pokazywały tę samą prowizję.

## Decyzje tj (19 IX 2026)

### D1 — trasa
`/admin/weekly`, link w sidenav jako pierwszy. Obecny `/admin` nietknięty. Plik z komentarzem
nagłówkowym `// TEMPORARY — replaced by stage 6 Przegląd (REBUILD_PLAN §6). Delete, don't refactor.`

### D2 — prowizja: wspólny helper, ta sama formuła
`src/lib/metrics/commission.ts` — `commissionPln(rows, rates)` wyciągnięte z
`finances/page.tsx` (formuła `offer_deposit_eur ?? deposit_amount ?? internal_commission_eur`,
`deal_currency`, kurs z `finance_settings`). `finances/page.tsx` przepięte na helper — **obie
strony jedna liczba**. Test: trzy wiersze z różnymi wypełnionymi polami + jeden USD → oczekiwana
suma PLN. Poprawna definicja (`deals.commission_cents`, kurs zamrożony) — etap 4; tu wpis w
komentarzu, nie w kodzie.

### D3 — osiem liczb (z §9)
| # | Liczba | Formuła (dzisiejsze tabele) | Okno | Metryka §7 |
|---|---|---|---|---|
| 1 | Prowizja narastająco | D2, wiersze z `deposit_paid_at IS NOT NULL` | od 1 I 2026 do dziś; cel 80 000 PLN | M1 |
| 2 | Bookingi w miesiącu | `COUNT(*) WHERE deposit_paid_at` w bieżącym miesiącu (+ poprzedni obok) | miesiąc kalendarzowy | M2 |
| 3 | Zapytania w tygodniu | `COUNT(*) WHERE created_at` w tygodniu | ISO tydzień pon–nd, Europe/Warsaw; bieżący + 4 poprzednie | M5 (licznik) |
| 4 | Qualified w tygodniu | j.w. `AND qualified='yes'`; obok liczba `unknown` (żeby było widać, ile nie ocenione) | j.w. | M5 |
| 5 | Wydatek na reklamy | `SUM(ad_campaigns.spend)` w tygodniu, przeliczony na PLN (waluta `spend` — ustal odczytem, patrz Zakres) | tydzień | M6 (licznik) |
| 6 | Koszt per zapytanie / per qualified | 5 ÷ 3 oraz 5 ÷ 4, tylko zapytania z `gclid IS NOT NULL OR utm->>'utm_medium' IN ('cpc','paid')` (atrybucja) — druga para liczb dla wszystkich | tydzień | M6 |
| 7 | Konwersja narastająca | `COUNT(deposit_paid_at) ÷ COUNT(*)` dla zapytań z `created_at ≥ 1 I 2026`; **z ostrzeżeniem** w UI, że kohortowo liczy się w etapie 5 (M7) i ta liczba kłamie przy 60+ dniach wyprzedzenia | od 1 I 2026 | M7 (przybliżenie) |
| 8 | Powody przegranych | `COUNT(*) GROUP BY lost_reason_code WHERE status='lost'`, ostatnie 90 dni; `NULL` jako osobny wiersz „bez kodu" | 90 dni | powody przegranych |

Każda liczba: wartość, definicja jednym zdaniem, link do `/admin/inquiries?…` (filtr, jeśli
istnieje) albo do `/admin/finances` / `/admin/ads`.

### D4 — liczymy z kolumn, nie ze zdarzeń
M5 z `inquiries.qualified`, nie z `inquiry_events` (deduplikacja zdarzeń nierozwiązana — wpis
FA-1.04). `inquiry_events` w tym ekranie **nie** są używane; historia z FA-1.05 zasila etap 5.

## Zakres
- [ ] **Odczyt (do raportu):** waluta `ad_campaigns.spend` (kod syncu + dashboard Google Ads);
      klucze w `finance_settings`; na lokalnym stacku po naprawie seeda: `SELECT qualified,
      count(*) FROM inquiries GROUP BY 1` i rozkład `priority`/`trip_country` — **domyka
      kryterium 1 FA-1.04**.
- [ ] `supabase/seed.sql` — UUID wersji `4` (wpis FA-1.12); seed pokrywa: zapytania w 3 różnych
      tygodniach, 2 z `deposit_paid_at` (jeden USD), 3 `lost` z różnymi kodami + 1 bez kodu,
      2 z `gclid`, `ad_campaigns` w dwóch tygodniach, `qualified` yes/no/unknown.
- [ ] `src/lib/metrics/` — czyste funkcje, jedna na liczbę, wejście = wiersze, wyjście = liczba
      (+ `commission.ts` z D2, `weeks.ts` — ISO tydzień w Europe/Warsaw, użyj `periods.ts` jeśli
      pasuje). Zero zapytań do bazy w tym katalogu.
- [ ] `src/app/admin/weekly/page.tsx` — server component: jedno–trzy zapytania (`inquiries`
      z potrzebnymi kolumnami od 1 I 2026, `ad_campaigns` od 5 tygodni, `finance_settings`),
      przekazane do funkcji z `src/lib/metrics/`; tabela 8 wierszy / kafelków, bez wykresów.
      `requireAdmin()`.
- [ ] `finances/page.tsx` przepięte na `commissionPln` (D2) — bez zmiany wyświetlanej liczby
      (zrzut przed/po w raporcie).
- [ ] Sidenav: „Weekly" jako pierwsza pozycja.
- [ ] Testy Vitest na każdej funkcji z `src/lib/metrics/` (tydzień na granicy roku, brak wierszy
      → 0 nie NaN, USD → PLN, `lost_reason_code NULL`, atrybucja `gclid`/`utm`).
- [ ] **Kryterium 4 FA-1.04:** na lokalnym stacku klasyfikacja testowego zapytania przez agenta →
      `qualified='yes'` + jeden wiersz `inquiry_events` typu `inquiry.qualified_set`,
      `actor_kind='agent'` — SELECT w raporcie; wiersz FA-1.04 w `deferred-tasks.md` zamknięty;
      status FA-1.04 w `INDEX.md` bez dopisku „kryteria odroczone".
- [ ] `docs/REBUILD_PLAN.md` §9 — dopisek: „zrobione w FA-1.10, `/admin/weekly`, do usunięcia w
      etapie 6".

## Gotowe, gdy
- [ ] `/admin/weekly` na lokalnym stacku z seedem pokazuje 8 liczb; zrzut ekranu w raporcie;
      każda liczba zgadza się z ręcznym SELECT-em na tych samych danych (8 SELECT-ów w raporcie).
- [ ] Prowizja na `/admin/weekly` == prowizja na `/admin/finances` (obie z seeda, w raporcie).
- [ ] **Na czerwono:** test `commissionPln` z wierszem `deal_currency='USD'` pada, gdy przeliczenie
      USD zostanie usunięte z helpera.
- [ ] **Na czerwono:** test tygodnia dla `2026-12-31` / `2027-01-01` (ISO tydzień 53/1) pada przy
      liczeniu po roku kalendarzowym.
- [ ] Brak wierszy (pusta baza) → strona renderuje zera, nie 500 (test lub zrzut).
- [ ] Kryteria 1 i 4 z FA-1.04 udowodnione (SELECT-y w raporcie), wpis w `deferred-tasks.md`
      zamknięty.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone (lint: zero błędów, jeśli
      FA-1.08 już weszło; inaczej nie gorzej niż `main`).

## Poza zakresem
- Widoki materializowane, `metric_snapshots`, `packages/core/metrics` — etap 5.
- Kohorty (M7 poprawnie), GA4 (M8/M9), czasy z `inquiry_events` (M10–M12) — etap 5/6.
- Wykresy, filtry dat, eksport — nie; ekran leci w etapie 6.
- Zmiana formuły prowizji na poprawną — etap 4 (D2).
- Naprawa `google-ads-api` crash (wpis FA-0.10) — nie; jeśli sync nie działa, `spend` w
  tygodniu pokazuje 0 z adnotacją „ostatni sync: <data>".
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zapis na produkcji — STOP; odczyt produkcji tylko SELECT z hasłem na jedno polecenie, jeśli
  seed nie wystarczy do ustalenia waluty `spend`.
- Jeśli `ad_campaigns.spend` okaże się w mieszanych walutach albo bez jednoznacznej — STOP,
  pokaż, nie zgaduj kursu.
- Jeśli przepięcie `finances/page.tsx` zmienia wyświetlaną liczbę — STOP, pokaż różnicę.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- metrics
pnpm typecheck && pnpm lint && pnpm build
supabase db reset && pnpm dev   # /admin/weekly vs 8 SELECT-ów
# SELECT qualified, count(*) FROM inquiries GROUP BY 1;
# SELECT lost_reason_code, count(*) FROM inquiries WHERE status='lost' AND updated_at > now()-interval '90 days' GROUP BY 1;
# SELECT date_trunc('week', created_at AT TIME ZONE 'Europe/Warsaw'), count(*), count(*) FILTER (WHERE qualified='yes') FROM inquiries GROUP BY 1 ORDER BY 1 DESC LIMIT 5;
```

## Notatki z realizacji
