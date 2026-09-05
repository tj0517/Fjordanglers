---
id: FA-1.09
title: Gorące akcje na `experience_pages` — tytuł, slug, cena i przewodnik wyprawy z `experience_page_id`, nie z `trip_id`
stage: 1
status: todo
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
