---
id: FA-0.18
title: `inquiries.trip_country` faktycznie zapisywane — dziś nic go nie ustawia
stage: 0
status: todo
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/inquiry-trip-country
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 3
owner: tj
---

# FA-0.18 — `trip_country` zapisywane przy tworzeniu zapytania

**Skąd to zadanie (przegląd 11 IX 2026).** Przy wycenie leadów dla FA-0.13 odczyt produkcji
pokazał, że **47 z 92 zapytań ma `trip_country = NULL`**. Kolumna istnieje od czasów
marketplace'u. Agent AI (`src/lib/ai/inquiry-agent.ts`, Round 1) klasyfikuje kraj z treści
wiadomości i ustawia go po fakcie dla zapytań z maila/WhatsAppa — ale tylko wtedy, gdy
`existing.trip_country` jest pusty; ta ścieżka nie pomaga zapytaniom z formularza, bo trafiają
tam z `trip_country = NULL` i zostają z wartością AI. Zapis ze strony przy insercie ma mieć
pierwszeństwo — AI zostaje jako fallback. 45 wypełnionych wierszy to efekt klasyfikacji AI
albo wpisy ręczne.

Skutek: żadna metryka per destynacja nie działa i nie zadziała — ani „ile zapytań z Patagonii",
ani „win rate per region", ani koszt per zapytanie w rozbiciu na kraje. Test Patagonii mierzy
lejek przed formularzem (`web_events`, FA-0.15), ale po formularzu ślad po destynacji ginie.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguła 1 (migracje) i 3 (warstwa danych); `docs/03-conventions.md`
- `src/app/api/inquiries/route.ts:84–140` — obie gałęzie (`trip_id` / `experience_page_id`)
  pobierają już `experience_pages` (`select('id, guide_id, experience_name')`) i wołają
  `createInquiry(...)`. To jest miejsce, w którym kraj jest znany i dziś wyrzucany.
- `src/lib/inquiries/create.ts` — `createInquiry`, sygnatura i mapowanie pól na kolumny
- `src/lib/ai/inquiry-agent.ts` — `classificationUpdate` i `runAgentRound1`: AI zapisuje
  `trip_country` po fakcie gdy pusty; to jest fallback dla maila/WhatsAppa, nie formularz
- `src/actions/inquiries.ts` — `createManualInquiry` (zapytania wpisywane ręcznie przez admina)
- `src/app/api/webhooks/email-inbound/route.ts`, `src/app/api/webhooks/whatsapp/route.ts`,
  `src/actions/ai.ts` — ścieżki spoza formularza; tu kraju często nie da się ustalić przy
  tworzeniu (patrz Zakres, punkt „przypisanie przewodnika")
- `src/lib/countries.ts` — `COUNTRIES`, `getRegionGroup()`; wartości muszą być z tej listy
- `docs/tasks/FA-0.13.md` — po co to jest (wartość leada per region)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Każde zapytanie utworzone z formularza ma `trip_country` równe `experience_pages.country` tej
strony. Zapytania z maila/WhatsAppa dostają kraj najpóźniej w chwili przypisania wyprawy.
`select trip_country, count(*) from inquiries group by 1` przestaje być zdominowane przez NULL.

## Zakres
- [ ] **Odczyt bieżącego stanu** (przez `supabase-fa`, tylko SELECT, wklej do raportu):
      ```sql
      select coalesce(trip_country,'(null)') as kraj, count(*) from inquiries group by 1 order by 2 desc;
      select source, count(*) filter (where trip_country is null) as bez_kraju, count(*) as razem
      from inquiries group by 1 order by 3 desc;
      select count(*) from inquiries i
      where i.trip_country is null and (i.trip_id is not null or i.experience_page_id is not null);
      ```
      Ostatnie zapytanie mówi, ile wierszy da się uzupełnić backfillem bez zgadywania.
- [ ] `src/app/api/inquiries/route.ts` — dodaj `country` do obu `select(...)` na
      `experience_pages` i przekaż do `createInquiry` jako `tripCountry`. Zero zmian w walidacji
      wejścia — kraj bierze się ze strony, nigdy z ciała żądania.
- [ ] `createInquiry` w `src/lib/inquiries/create.ts` — nowy opcjonalny parametr `tripCountry`,
      mapowany na kolumnę `trip_country`. Brak → `null`, jak dziś.
- [ ] `createManualInquiry` (`src/actions/inquiries.ts`) — dropdown przekazuje
      `experience_page_id`; pobierz kraj z tej samej strony i zapisz. Jeśli admin nie wskazał
      wyprawy, zostaje `null`.
- [ ] **Przypisanie przewodnika/wyprawy** — w miejscu, gdzie zapytanie dostaje `trip_id` albo
      `experience_page_id` po fakcie (ścieżka mailowa/WhatsApp), uzupełnij `trip_country`, jeśli
      jest `null`. Znajdź to miejsce odczytem, nie z pamięci; jeśli takich miejsc jest kilka,
      wypisz je i zapytaj, zanim dotkniesz więcej niż jednego.
- [ ] **Backfill historyczny** — `UPDATE inquiries SET trip_country = ep.country FROM
      experience_pages ep WHERE ...` dla wierszy z `trip_id`/`experience_page_id` i `trip_country IS NULL`.
      **STOP** przed wykonaniem: pokaż SELECT z liczbą wierszy i przykładami, czekaj na „go".
      Wiersze bez żadnego powiązania zostają `NULL` — nie zgaduj po treści wiadomości.
- [ ] Regeneracja typów, jeśli cokolwiek zmieni się w schemacie (nie powinno — kolumna istnieje).

## Gotowe, gdy
- [ ] **Czerwony dowód**: lokalnie utwórz zapytanie przez `POST /api/inquiries` dla strony z
      `country='Chile'` → `SELECT trip_country` zwraca `Chile`; to samo dla strony z `country='Iceland'`.
      Oba wyniki wklejone. Wiersz wstawiony psql-em nie zalicza tego kryterium.
- [ ] `grep -n "trip_country\|tripCountry" src/lib/inquiries/create.ts` → parametr obecny w
      insert (nie tylko typy — konkretne mapowanie na kolumnę).
- [ ] Po backfillu (po „go" tj): `select coalesce(trip_country,'(null)'), count(*) from inquiries
      group by 1 order by 2 desc` — liczba NULL-i spadła o tyle, ile zapowiadał SELECT przed.
- [ ] `supabase db diff --local` → `No schema changes found` (to zadanie nie zmienia schematu).
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` bez nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Zgadywanie kraju z treści maila/WhatsAppa przez AI — jeśli wyprawa nie jest przypisana, zostaje `NULL`.
- Ujednolicenie listy krajów agenta AI z `COUNTRIES` w `src/lib/countries.ts` (agent może
  zwracać `'Other'`) — odkładamy do `docs/deferred-tasks.md`.
- Zmiana typu kolumny na enum / FK do `countries` — etap 4, do rozważenia przy refaktorze schematu.
- `angler_country` (kraj klienta) — inny byt, nie dotykamy.
- Jakiekolwiek metryki i ekrany czytające `trip_country` — etap 5/6.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- `UPDATE` backfillowy na produkcji — **STOP**: SELECT przed, dokładny SQL, zgoda tj.
  Zapis przez `apply_migration`/`execute_sql` w `supabase-fa` to ta sama bramka co `db push`;
  po `apply_migration` rename pliku lokalnego wg `docs/03-conventions.md`.
- Jeśli odczyt pokaże wartości `trip_country` spoza `COUNTRIES` — `'Other'` od agenta AI to
  stan znany, zgłoś liczbę i kontynuuj; **STOP** tylko dla innych nieoczekiwanych wartości
  (literówki, skróty, `NZ` itp.); zgłoś listę i zaproponuj osobne zadanie do ujednolicenia.
- Jeśli miejsc przypisujących wyprawę po fakcie jest więcej niż jedno — **STOP**, wypisz i zapytaj.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci ani z `database.types.ts`.

## Weryfikacja
```
grep -rn "trip_country" src
supabase db diff --local
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji
