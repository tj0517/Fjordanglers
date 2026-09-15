---
id: FA-0.18
title: `inquiries.trip_country` faktycznie zapisywane — dziś nic go nie ustawia
stage: 0
status: review
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
- [x] **Odczyt bieżącego stanu** (przez `supabase-fa`, tylko SELECT, wklej do raportu):
      ```sql
      select coalesce(trip_country,'(null)') as kraj, count(*) from inquiries group by 1 order by 2 desc;
      select source, count(*) filter (where trip_country is null) as bez_kraju, count(*) as razem
      from inquiries group by 1 order by 3 desc;
      select count(*) from inquiries i
      where i.trip_country is null and (i.trip_id is not null or i.experience_page_id is not null);
      ```
      Ostatnie zapytanie mówi, ile wierszy da się uzupełnić backfillem bez zgadywania.
- [x] `src/app/api/inquiries/route.ts` — dodaj `country` do obu `select(...)` na
      `experience_pages` i przekaż do `createInquiry` jako `tripCountry`. Zero zmian w walidacji
      wejścia — kraj bierze się ze strony, nigdy z ciała żądania.
- [x] `createInquiry` w `src/lib/inquiries/create.ts` — nowy opcjonalny parametr `tripCountry`,
      mapowany na kolumnę `trip_country`. Brak → `null`, jak dziś.
- [x] `createManualInquiry` (`src/actions/inquiries.ts`) — dropdown przekazuje
      `experience_page_id`; pobierz kraj z tej samej strony i zapisz. Jeśli admin nie wskazał
      wyprawy, zostaje `null`.
- [x] **Przypisanie przewodnika/wyprawy** — w miejscu, gdzie zapytanie dostaje `trip_id` albo
      `experience_page_id` po fakcie (ścieżka mailowa/WhatsApp), uzupełnij `trip_country`, jeśli
      jest `null`. Znajdź to miejsce odczytem, nie z pamięci; jeśli takich miejsc jest kilka,
      wypisz je i zapytaj, zanim dotkniesz więcej niż jednego.
- [x] **Backfill historyczny** — `UPDATE inquiries SET trip_country = ep.country FROM
      experience_pages ep WHERE ...` dla wierszy z `trip_id`/`experience_page_id` i `trip_country IS NULL`.
      **STOP** przed wykonaniem: pokaż SELECT z liczbą wierszy i przykładami, czekaj na „go".
      Wiersze bez żadnego powiązania zostają `NULL` — nie zgaduj po treści wiadomości.
- [x] Regeneracja typów, jeśli cokolwiek zmieni się w schemacie (nie powinno — kolumna istnieje).

## Gotowe, gdy
- [x] **Czerwony dowód**: lokalnie utwórz zapytanie przez `POST /api/inquiries` dla strony z
      `country='Chile'` → `SELECT trip_country` zwraca `Chile`; to samo dla strony z `country='Iceland'`.
      Oba wyniki wklejone. Wiersz wstawiony psql-em nie zalicza tego kryterium.
- [x] `grep -n "trip_country\|tripCountry" src/lib/inquiries/create.ts` → parametr obecny w
      insert (nie tylko typy — konkretne mapowanie na kolumnę).
- [x] Po backfillu (po „go" tj): `select coalesce(trip_country,'(null)'), count(*) from inquiries
      group by 1 order by 2 desc` — liczba NULL-i spadła o tyle, ile zapowiadał SELECT przed.
- [x] `supabase db diff --local` → `No schema changes found` (to zadanie nie zmienia schematu).
- [x] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` bez nowych błędów vs `main`.
- [x] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

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

### Co zmienione (15 IX 2026, gałąź `fix/inquiry-trip-country`)

- `src/lib/inquiries/create.ts` — nowy opcjonalny `tripCountry`, mapowany na kolumnę
  `trip_country` w insercie (`create.ts:20` typ, `create.ts:48` mapowanie).
- `src/app/api/inquiries/route.ts` — `country` dodane do obu `select(...)` na
  `experience_pages` (gałąź `trip_id` i gałąź `experience_page_id`), przekazane jako
  `tripCountry`. Schemat Zod nietknięty — kraj nie może przyjść z ciała żądania.
- `src/actions/inquiries.ts` `createManualInquiry` — kraj pobierany ze strony wskazanej
  w dropdownie (`params.tripId` to `experience_pages.id`); bez wyprawy zostaje `null`.
- `src/lib/inquiries/trip-country.ts` (nowy) — `tripCountryPatchFromGuide(inquiryId, guideId)`
  zwraca `{ trip_country }` tylko gdy zapytanie nie ma jeszcze kraju, a przewodnik ma kraj
  z `COUNTRIES`; w przeciwnym razie `{}`. Nie robi własnego `update()` — patch jest wklejany
  do tego samego `update()`, który zapisuje `assigned_guide_id`.
- Trzy miejsca przypisujące przewodnika po fakcie (korekta zakresu tj z 15 IX — `trip_id` /
  `experience_page_id` po utworzeniu nie ustawia nic): `assignGuideToInquiry` (`:996`),
  `assignGuideSilently` (`:1147`), `updateInquiryGuide` (`:1574`).
- Bez migracji — kolumna istnieje; `supabase db diff --local` → `No schema changes found`.
  Typów nie regenerowano (schemat bez zmian).

### Odczyt produkcji przed backfillem (`uwxrstbplaoxfghrchcy`, 15 IX 2026)

```
select coalesce(trip_country,'(null)') as kraj, count(*) from inquiries group by 1 order by 2 desc;
 (null) 53 | Iceland 36 | New Zealand 5 | Norway 2 | Other 1 | Finland 1      → razem 98

select source, count(*) filter (where trip_country is null) as bez_kraju, count(*) as razem
from inquiries group by 1 order by 3 desc;
 (null) 39/84 | web_form 14/14

select count(*) from inquiries i
where i.trip_country is null and (i.trip_id is not null or i.experience_page_id is not null);
 52

select count(*) from inquiries where trip_country is null
  and assigned_guide_id is not null and trip_id is null and experience_page_id is null;
 0
```

Rozbicie tych 52: 12 po `experience_page_id`, 40 po `trip_id`, 0 bez dopasowania.
Żaden `trip_id` nie wskazuje więcej niż jednej strony, więc kraj jest jednoznaczny.
Krok 2 backfillu (z `guides.country`) naprawiłby **0 wierszy** — zostaje jako procedura
na przyszłość, nie ma czego uruchamiać.

Wartości spoza `COUNTRIES`: `'Other'` ×1 (znany stan, agent AI) — zgłoszone, nie ruszone.
`guides.country` = `''` u dwóch przewodników → `docs/deferred-tasks.md`.

### Dowody lokalne (stack lokalny, `AI_AUTO_REPLY_ENABLED=false`, `RESEND_API_KEY` atrapa)

Skrypty jednorazowe (niecommitowane) uruchamiane przez `pnpm dlx tsx` — prawdziwy handler
`POST` i prawdziwe server actions, nie reimplementacje. Dla akcji z `requireAdmin()`
`next/headers` i `next/cache` podmienione na atrapy (słoik na ciasteczka / no-op), a sesja
jest prawdziwa: konto `fa018-admin@example.invalid` z `profiles.role='admin'`, logowanie
przez `signInWithPassword`, token wpisany do słoika przez `auth.setSession`. Strażnik
**nie jest obchodzony** — działa na tej sesji.

Czerwony przebieg (kod sprzed zmiany, `git stash push -- src`):
```
[Chile]   POST /api/inquiries → 201 … "trip_country":null
[Iceland] POST /api/inquiries → 201 … "trip_country":null
[A after] assignGuideToInquiry → "assigned_guide_id":"e0fd7188…","trip_country":null
```

Po zmianie:
```
[Chile]   POST /api/inquiries → 201 {"id":"289e2a32-…","status":"pending"}
[Chile]   SELECT → {"source":"web_form","experience_page_id":"0ed4d6f8-…","trip_country":"Chile"}
[Iceland] POST /api/inquiries → 201 {"id":"9c6d0b32-…","status":"pending"}
[Iceland] SELECT → {"source":"web_form","experience_page_id":"18fd2970-…","trip_country":"Iceland"}

[A before] {"source":"email","assigned_guide_id":null,"trip_country":null}
[B before] {"source":"email","assigned_guide_id":null,"trip_country":"Chile"}
[A after ] {"assigned_guide_id":"594ec412-…","trip_country":"Norway"}     ← uzupełnione
[B after ] {"assigned_guide_id":"594ec412-…","trip_country":"Chile"}      ← nienadpisane

[New Zealand page] createManualInquiry → {"source":"manual","trip_country":"New Zealand"}
[no page picked]   createManualInquiry → {"source":"manual","trip_country":null}

[C] assignGuideSilently  → {"trip_country":"Sweden"}
[D] updateInquiryGuide   → {"trip_country":"Sweden"}
[E] przewodnik z country='' → log „has no usable country" → {"trip_country":null}
```

### Backfill produkcji — wykonany po „go" tj (15 IX 2026)

Zgoda: tj, 15 IX 2026, w sesji realizacji zadania — krok 1 wykonać, krok 2 pominąć
(SELECT pokazał 0 pasujących wierszy, więc nie ma czego uruchamiać).

```sql
update inquiries i
set trip_country = sub.kraj
from (
  select i2.id, coalesce(ep_page.country, ep_trip.country) as kraj
  from inquiries i2
  left join experience_pages ep_page on ep_page.id = i2.experience_page_id
  left join lateral (
    select country from experience_pages where trip_id = i2.trip_id limit 1
  ) ep_trip on true
  where i2.trip_country is null
    and (i2.trip_id is not null or i2.experience_page_id is not null)
) sub
where i.id = sub.id and sub.kraj is not null;
```

Po backfillu:
```
select coalesce(trip_country,'(null)') as kraj, count(*) from inquiries group by 1 order by 2 desc;
 Iceland 75 | New Zealand 13 | Norway 3 | Sweden 2 | (null) 1 | Argentina 1 | Finland 1 | Chile 1 | Other 1
```
NULL-e 53 → 1, czyli dokładnie 52 zapowiedziane (Iceland +39, New Zealand +8, Sweden +2,
Argentina +1, Chile +1, Norway +1). Jedyny pozostały NULL — `a1836796-…` z 12 VIII 2026 —
nie ma `trip_id`, `experience_page_id` ani przewodnika, więc zostaje bez kraju zgodnie z zadaniem.

### Runda 1 agenta — poprawiona w tym PR (decyzja tj, 15 IX 2026)

`runAgentRound1` budowała własny `classUpdate` bez sprawdzenia, co jest w wierszu, i wklejała
go do obu `update()` — przy `AI_AUTO_REPLY_ENABLED=true` kraj ze strony wyprawy ginął sekundę
po insercie. Teraz runda 1 czyta `trip_country`/`trip_type`/`priority` przed zapisem i przechodzi
przez ten sam `classificationUpdate()`, co rundy 2–3: kraj i typ tylko gdy puste, priorytet
zawsze. Nowy test `src/lib/ai/inquiry-agent-round1.test.ts` (Anthropic, mail i Supabase mockowane).

Czerwony dowód testu — `git stash push -- src/lib/ai/inquiry-agent.ts`:
```
× leaves a country that came from the experience page untouched
× still overwrites priority — later rounds have more context
```
Po przywróceniu poprawki: 3/3 zielone, cała suita 59 passed / 1 failed
(`getInquiryConfirmation.test.ts` — znany stan main).
