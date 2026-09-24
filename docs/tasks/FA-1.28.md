---
id: FA-1.28
title: Kwota depozytu w danych — kwota w groszach, waluta opcji, kurs do EUR zamrożony; pole kwoty na karcie z podpowiedzią 20%
stage: 1
status: review
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-db
branch: feat/deposit-amount
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
pr: 103
estimate_h: 6
owner: tj
---

# FA-1.28 — Kwota depozytu w danych

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły 1 (schemat tylko migracjami), 2 (stan bazy odczytem), 5 (każda zmiana stanu emituje zdarzenie), 6 (pieniądze = grosze + waluta, kurs zamrożony w chwili zdarzenia), 7 (rezerwacja = opłacony depozyt)
- `docs/03-conventions.md` — konwencje kodu, migracji i testów
- `docs/02-data-model.md` + `docs/audit/rebuild-audit-db-aug-2026.md` — model danych
- `supabase/migrations/20260904165037_baseline_prod.sql` — `inquiries`: `deposit_amount` (numeric, traktowane jako EUR), `offer_deposit_eur`, `deal_currency` z CHECK tylko `EUR`/`USD`
- `supabase/migrations/20260917104506_add_offers.sql` — `offer_options.price_cents` (BIGINT) + `currency`, `is_accepted`
- `src/app/admin/inquiries/[id]/ThreadActionsPanel.tsx` (~369) — przycisk „Create Deposit Link” renderuje się tylko przy `depositAmountEur != null`; `page.tsx` (~550) podaje `inquiry.deposit_amount`
- `src/app/api/webhooks/stripe-deposit/route.ts` (~131, ~186) — webhook czyta `deposit_amount ?? 0` jako EUR
- `src/lib/metrics/commission.ts`, `src/app/admin/finances/pipeline-utils.ts` — kolejność pól kwoty i przeliczenie tylko z USD
- `src/lib/fx.ts` — `fetchEurRate()` (frankfurter.app, dane EBC)
- `docs/deferred-tasks.md` — wiersz FA-1.18 „STAGE-1 RELEASE BLOCKER — brak settera `deposit_amount`”

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś panel nie ma jak ustawić kwoty depozytu, więc przycisk „Create Deposit Link” nigdy się nie pokazuje dla prawdziwego zapytania — ta ścieżka jest zepsuta na produkcji od 19 IX. Do tego kod zakłada, że depozyt jest zawsze w EUR, a klienci płacą w walucie oferty (EUR, USD, ISK, NZD). Po zadaniu admin ustawia kwotę depozytu na karcie (podpowiedź 20% ceny zaakceptowanej opcji, do zmiany), kwota zapisuje się w groszach z walutą i kursem do EUR zamrożonym w chwili zapisu, a webhook i metryki prowizji liczą z tych pól. Samo tworzenie linku to FA-1.29.

## Decyzje tj (24 IX 2026, wf-plan)
- Depozyt = **20%** ceny zaakceptowanej opcji; cena opcji to **cena za całą grupę** (bez mnożenia przez liczbę osób).
- Kwota to **podpowiedź do zmiany** przed utworzeniem linku.
- Waluta depozytu = **waluta opcji** (dziś w użyciu: EUR, USD, ISK, NZD).
- Kurs do EUR zamrożony w chwili zapisu kwoty (reguła 6), ze źródła, którego aplikacja już używa (`fetchEurRate`).
- Wydanie przez `stage-1` (nie hotfix na `main`).

## Zakres
- [ ] Odczyt bieżącego stanu (do raportu): kolumny `inquiries` związane z depozytem i walutą (`information_schema.columns`); na produkcji: `SELECT currency, count(*) FROM offer_options GROUP BY 1`; liczba zapytań z zaakceptowaną opcją i pustym `deposit_amount`; czy `inquiry_events.type` jest ograniczony w bazie (CHECK/enum).
- [ ] STOP — projekt kolumn przed napisaniem migracji (niżej).
- [ ] Migracja: kwota depozytu w groszach (BIGINT), waluta (CHECK na dozwolone waluty), kurs do EUR (numeric) + znacznik czasu kursu; kolumny na aktywny link płatności (id, URL) — **puste, wypełnia je FA-1.29** (jedna migracja w paczce zamiast dwóch). Jeśli typ zdarzenia jest ograniczony w bazie — nowy typ w tej samej migracji.
- [ ] Regeneracja typów (`pnpm supabase:types`).
- [ ] Jedna stała `DEPOSIT_PERCENT = 20` w jednym miejscu w kodzie.
- [ ] Akcja serwerowa ustawiająca kwotę: `requireAdmin()`, walidacja (kwota > 0, waluta = waluta zaakceptowanej opcji, kurs pobrany — brak kursu = błąd bez zapisu), zapis kwoty + waluty + kursu, zdarzenie w `inquiry_events` (np. `deposit.amount_set` z kwotą, walutą i kursem w payloadzie).
- [ ] Karta zapytania: przy zaakceptowanej opcji pole kwoty z podpowiedzią `20% × cena opcji` w walucie opcji, edytowalne, zapis przyciskiem ze stanem „trwa” i blokadą podwójnego kliknięcia.
- [ ] Webhook depozytu i metryki prowizji (`commission.ts`, `pipeline-utils.ts`, `/admin/weekly`, `/admin/finances`) czytają nowe pola; EUR liczone przez zamrożony kurs. Stare wiersze bez nowych pól liczone dokładnie jak przed zmianą.
- [ ] Testy jednostkowe: podpowiedź (20% ceny za grupę, zaokrąglenie do pełnych groszy / jednostek waluty — także ISK); walidacja akcji; przeliczenie w metrykach; webhook na nowych polach i na starym wierszu.

## Gotowe, gdy
- [ ] Migracja przechodzi na czysto: `supabase db reset` lokalnie bez błędów; nowe kolumny widoczne w `information_schema.columns` — **wklej wynik**. Job `db` w CI zielony.
- [ ] Typy zregenerowane: `git diff --stat stage-1...HEAD -- src/lib/supabase/database.types.ts` niepusty; brak nowych `as any`.
- [ ] Podpowiedź na karcie: lokalnie, opcja 1 000 EUR zaakceptowana → pole pokazuje 200,00 EUR; opcja 150 000 ISK → 30 000 ISK — **zrzuty Playwright** w `.playwright-mcp`, ścieżki w raporcie.
- [ ] Zapis: po zapisaniu kwoty `SELECT` na nowych kolumnach pokazuje kwotę w groszach, walutę i kurs; w `inquiry_events` jest zdarzenie z tymi wartościami — **wklej oba wyniki**.
- [ ] Red proof: zapis z walutą inną niż waluta opcji, z kwotą ≤ 0 i przy braku kursu → odrzucony, w bazie nic się nie zmienia (testy, nazwy w raporcie, wynik na czerwono przed poprawką albo test na celowo złym wejściu).
- [ ] Metryki: test — depozyt w ISK z kursem X daje w prowizji Y EUR; wiersz sprzed zmiany (bez nowych pól) daje tę samą liczbę co przed zmianą.
- [ ] `pnpm typecheck && pnpm lint && pnpm test run` zielone.

## Poza zakresem
- Tworzenie linku, status „czeka na płatność”, jeden aktywny link, wyświetlanie linku → FA-1.29
- Nazwa i opis produktu w Stripe, treść wiadomości z linkiem → FA-1.30
- Stany ładowania innych akcji i nawigacji → FA-1.31; wygląd karty → FA-1.32
- Zmiana `deal_currency` (CHECK EUR/USD) i finansów wewnętrznych (`internal_*`)
- Procent depozytu edytowalny w panelu (dziś stała w kodzie; edycja w panelu to osobna decyzja)
- Backfill kwot dla starych zapytań
- Stara ścieżka `sendDepositLink` (Checkout Session) — nie ruszać; jej usunięcie to osobne zadanie
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed napisaniem migracji — pokaż nazwy i typy kolumn, CHECK na waluty i ewentualną zmianę typów zdarzeń; czekaj na akceptację.
- Jakikolwiek zapis na produkcji — zakaz. Migracja trafia na produkcję z paczką `stage-1`; `supabase db push` robi tj.
- Edycja istniejącej migracji — zakaz; tylko nowy plik.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54422/postgres" -c "select column_name, data_type from information_schema.columns where table_name='inquiries' and column_name like 'deposit%'"
git diff --stat stage-1...HEAD -- src/lib/supabase/database.types.ts
pnpm typecheck && pnpm lint && pnpm test run
```
(Wpisz `pnpm supabase:types:local` zamiast `pnpm supabase:types`, które nie istnieje.)

## Notatki z realizacji
- 2026-09-24 tj (wf-plan): zadanie powstało z wiersza FA-1.18 w `docs/deferred-tasks.md` (bloker na żywej ścieżce, kod na produkcji od 19 IX); decyzje w sekcji „Decyzje tj”.
- 2026-09-24 tj (wf-task): przycisk „Create Deposit Link” (warunek pokazania i działanie) w całości w FA-1.29; 1.28 tylko ustawia i zapisuje kwotę.
- 2026-09-24 tj (STOP migracji): waluty depozytu tylko EUR/USD/ISK/NZD (CHECK w bazie; oferta w innej walucie, np. NOK/SEK, nie dostanie depozytu do czasu migracji rozszerzającej listę); baza pilnuje „wszystko albo nic” i kwoty > 0; ISK w groszach (×100) jak offer_options.price_cents.
