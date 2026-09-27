---
id: FA-1.35
title: Jedna definicja faktów dla wykresów — booking = `deposit_paid_at`, prowizja z helpera; `/admin/finances` bez statusów sprzed FA-1.03, `/admin/pipeline` na tym samym helperze
stage: 1
status: review
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-admin
branch: fix/metric-facts-one-definition
pr: 116
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.35 — Jedna definicja faktów dla wszystkich wykresów

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne; **reguła 7: booking = zapłacony depozyt (`deposit_paid_at`)**, reguła 3 (`.from(` tylko w warstwie danych)
- `docs/03-conventions.md` — konwencje kodu
- `src/lib/metrics/commission.ts` — `rowCommissionEur` / `commissionPln`: jedyna formuła prowizji (FA-1.10 D2, FA-1.28 grosze + zamrożony kurs)
- `src/lib/metrics/weekly.ts` — `/admin/weekly` już liczy booking z `deposit_paid_at`; **plik TEMPORARY — nie refaktoruj go**, jest wzorcem definicji
- `src/app/admin/finances/page.tsx` (~96–125, ~150–215) — przychód filtruje `.in('status', ['deposit_paid','completed'])` (nazwy sprzed FA-1.03), miesiąc z `deposit_paid_at ?? updated_at`; „open deals” filtruje wyłącznie po starych statusach
- `src/app/admin/finances/PipelineClient.tsx`, `pipeline-utils.ts` — lista otwartych transakcji
- `src/app/admin/pipeline/page.tsx`, `PipelineClient.tsx` (~48–55, ~139–170, ~312) — booking z `DEPOSIT_STATUSES`/`stage_reached`, prowizja tylko z `internal_commission_eur`
- `src/lib/inquiries/state.ts` — `STATUSES` (nazwy po FA-1.03)
- `docs/deferred-tasks.md` wiersze „FA-1.05 audit” — `deposit_paid_at` puste w historii (po tym zadaniu historia pokaże 0 bookingów, dopóki FA-1.39 jej nie uzupełni — to zamierzone)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś trzy ekrany liczą „booking” trzema regułami: `/admin/weekly` z daty wpłaty, `/admin/finances` ze statusów, które po FA-1.03 już nie istnieją (zapytania `paid`/`handed_over` w ogóle nie wchodzą do przychodu, lista otwartych transakcji jest zawsze pusta), `/admin/pipeline` ze statusu i `stage_reached`, z prowizją z jednej starej kolumny. Nawet idealnie uzupełnione dane dałyby trzy różne liczby. Po tym zadaniu każdy ekran pyta o te same fakty w ten sam sposób: booking = wypełnione `deposit_paid_at`, jego data = `deposit_paid_at`, prowizja = `rowCommissionEur`. Historia do czasu FA-1.39 pokaże mniej bookingów niż dziś — i to jest prawda o danych, nie błąd.

## Zakres
- [ ] Odczyt bieżącego stanu: wszystkie miejsca w `src/app/admin/**` i `src/lib/metrics/**`, które decydują „czy booking”, „kiedy booking”, „ile prowizji”, „czy otwarta transakcja” — lista z plikami i liniami do raportu (`grep -rn "deposit_paid_at\|DEPOSIT_STATUSES\|internal_commission_eur\|in('status'" src/app/admin src/lib/metrics`).
- [ ] `src/lib/metrics/facts.ts` (stały, nie TEMPORARY): `isBooked(row)` (= `deposit_paid_at !== null`, niezależnie od statusu), `bookedAt(row)`, `OPEN_DEAL_STATUSES` wyprowadzone ze `STATUSES` w `state.ts` (niezakończone i niezapłacone: `new`, `qualifying`, `waiting_guide`, `offer_presented`, `awaiting_payment`). Prowizja: reużyj `rowCommissionEur` — nie duplikuj.
- [ ] `/admin/finances`: przychód = wiersze z `deposit_paid_at IS NOT NULL` (bez filtra statusu), miesiąc wyłącznie z `deposit_paid_at` (bez `?? updated_at`); „open deals” na `OPEN_DEAL_STATUSES`; tekst pustego stanu bez nazwy `deposit_sent`.
- [ ] `/admin/pipeline`: „deposits/closed” = `isBooked`, prowizja przez `rowCommissionEur`. `stage_reached` zostaje do „jak daleko zaszło” (oferty wysłane) — to inna miara niż booking.
- [ ] Testy Vitest dla `facts.ts` i zmienionych funkcji czystych.
- [ ] Jeśli w `/admin/weekly` znajdziesz inną definicję niż `isBooked` — nie ruszaj, zgłoś w „Noticed”.

## Gotowe, gdy
- [ ] **Na czerwono:** test „zapytanie ze statusem `paid` i `deposit_paid_at = null` nie jest bookingiem” pada, gdy `isBooked` zostanie przełączone na status — wklejony wynik czerwony i zielony.
- [ ] Test: wiersz z `deposit_paid_at` w maju i `updated_at` we wrześniu trafia do przychodu **maja**; wiersz bez `deposit_paid_at` nie trafia nigdzie (`pnpm test -- facts finances`).
- [ ] Test: na `/admin/pipeline` wiersz z samymi kolumnami FA-1.28 (`deposit_amount_cents`, `deposit_eur_rate`) ma prowizję równą `rowCommissionEur`, nie 0.
- [ ] Na lokalnym stacku z seedem, dla miesiąca M = miesiąc zaseedowanego `deposit_paid_at` (z SELECT-a, nie „bieżący miesiąc"): (a) `/admin/weekly` i `/admin/finances` pokazują tę samą liczbę bookingów dla M, równą `SELECT count(*) FROM inquiries WHERE date_trunc('month', deposit_paid_at AT TIME ZONE 'Europe/Warsaw') = M`; (b) `/admin/pipeline` (monthly, period M) pokazuje deposits równe `SELECT count(*) FROM inquiries WHERE date_trunc('month', created_at AT TIME ZONE 'Europe/Warsaw') = M AND deposit_paid_at IS NOT NULL`. Wklejone oba SELECT-y z wynikami i wartości z ekranów. *(Zmienione z „ta sama liczba na trzech ekranach" przez tj 2026-09-27: pipeline to widok kohortowy po dacie zapytania, weekly/finances liczą po dacie płatności — każdy sprawdzany wg własnej definicji.)*
- [ ] `grep -rnE "'(deposit_paid|deposit_sent|waiting_for_deposit|in_negotiation|waiting_for_guide_offer|pending)'" src/app/admin/finances src/app/admin/pipeline` nie zwraca porównań ze **statusem** (wartości `stage_reached` w `STAGE_ORDER` są dozwolone — wypisz je w raporcie).
- [ ] Brak nowych `.from(` w `src/app/**` (`git diff main...HEAD -- 'src/app/**' | grep -n '^+.*\.from('` → pusto); `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Nowe wykresy, filtry, przeprojektowanie ekranów — etap 6.
- Refaktor `/admin/weekly` i `src/lib/metrics/weekly.ts` (TEMPORARY) — nie.
- Przeniesienie istniejących `.from(` z `finances/page.tsx` i `pipeline/page.tsx` do `src/actions` — kuszące, osobne zadanie (wpis do `deferred-tasks.md`).
- Zmiana formuły prowizji / O-05, O-06 — etap 4.
- Lista braków w danych — FA-1.36; wpisywanie historii — FA-1.37/FA-1.38.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (bez zapisu do bazy). Jeśli okaże się, że zmiana wymaga migracji — STOP, pokaż dlaczego.

## Weryfikacja
```
pnpm test -- facts finances pipeline
grep -rnE "'(deposit_paid|deposit_sent|waiting_for_deposit|in_negotiation|waiting_for_guide_offer|pending)'" src/app/admin/finances src/app/admin/pipeline
supabase db reset && pnpm dev   # /admin/weekly, /admin/finances, /admin/pipeline — ta sama liczba bookingów
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # build przy zatrzymanym stacku (docs/05 §9)
```

## Notatki z realizacji
- 2026-09-27 tj (wf-plan): cel „wykresy mówią prawdę” = każdy rekord osobno (D1); booking definiuje reguła 7 CLAUDE.md.
- 2026-09-27 tj (wf-task): kryterium 4 zmienione z „ta sama liczba na trzech ekranach" na osobne sprawdzenie weekly/finances (data płatności) vs pipeline (kohorta po `created_at`) — pipeline zostaje widokiem kohortowym, nie zmienia się na okresy wg daty płatności.
- 2026-09-27 tj: `docker ps` pokazał już działający pełny stack Supabase innego projektu („Seaclouds_management_system") na domyślnych portach 54321–54327; tj potwierdził kontynuację — fjordanglers ma własny zakres portów w `supabase/config.toml` (54420–54429), więc bez konfliktu.
- 2026-09-27 tj: pamięć sesji zabraniała `pnpm dev`/`pnpm start` (`.env.local` wskazuje na zdalny testowy projekt Supabase). Dla weryfikacji UI tj wybrał uruchomienie `pnpm dev` z nadpisanymi zmiennymi środowiskowymi (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` wskazującymi na lokalny stack, port 54421) zamiast edycji `.env.local`.
