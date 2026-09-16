---
id: FA-0.21
title: Testy integracyjne piszą do produkcji — `.env.test` i granica, której nie da się przekroczyć przypadkiem
stage: 0
status: in_progress
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: fix/tests-never-touch-prod
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 3
owner: tj
---

# FA-0.21 — `pnpm test` nie może pisać do bazy klientów

**Skąd to zadanie (odbiór FA-0.20, 16 IX 2026).** `pnpm test` wstawia wiersze do
**produkcyjnej** tabeli `inquiries` kluczem serwisowym, który omija RLS.

Mechanizm: `src/actions/getInquiryConfirmation.test.ts` i
`src/actions/__tests__/inquiryStatusDefault.test.ts` ręcznie parsują `.env.local`
w `beforeAll`, wołają `createServiceClient()` i robią `INSERT` do `inquiries`.
`.env.local:7` to `NEXT_PUBLIC_SUPABASE_URL=https://uwxrstbplaoxfghrchcy.supabase.co`,
czyli produkcja. `vitest.config.ts` nie ma `setupFiles` ani sekcji `env`, a plik
`.env.test` nie istnieje — nic nie stoi między testem a żywą bazą.

**Dlaczego to przeżyło.** Wzorzec jest starszy niż zadanie, które go ujawniło —
`getInquiryConfirmation.test.ts` ma to w nagłówku wprost („env from `.env.local`").
Agent FA-0.20 poszedł za tym, co już było w repo. Dodatkowo przez 11–15 IX chroniły
produkcję **martwe klucze legacy**: `INSERT`-y padały na 401. Wymiana kluczy 15 IX
tę przypadkową osłonę zdjęła.

**Stan szkód: zero.** Produkcja sprawdzona dwukrotnie (16 IX) — brak wierszy testowych.
`afterAll` sprząta, gdy przebieg kończy się normalnie. Problemem jest to, co się stanie,
gdy się nie skończy: sprzątanie jest warunkowe (`if (insertedId == null) return`), więc
przerwany przebieg albo błąd przed przypisaniem id zostawia wiersz w bazie klientów.

**Dlaczego teraz, a nie kiedyś.** FA-1.03 (rejestrator `inquiry_events` + `transition()`)
i FA-1.05 (backfill zdarzeń) piszą do tej samej tabeli i będą miały własne testy.
To zadanie musi wejść przed nimi.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`
- `vitest.config.ts` — brak `setupFiles`, brak `env`
- `src/actions/getInquiryConfirmation.test.ts` — `beforeAll` parsujący `.env.local`, `INSERT`
- `src/actions/__tests__/inquiryStatusDefault.test.ts` — ten sam wzorzec (FA-0.20)
- `src/actions/__tests__/authorization.test.ts` — przeciwwzorzec: mockuje `createClient`,
  używa fikcyjnego `https://test.supabase.co`; **tak ma wyglądać test, który nie potrzebuje bazy**
- `src/lib/supabase/server.ts` — `createServiceClient()`
- `supabase/config.toml` — lokalny stack: API `54421`, db `54422`, shadow `54420`
- `docs/deferred-tasks.md` — wpis pod FA-0.20 opisujący ten problem

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
`pnpm test` nie jest w stanie dotknąć produkcji — nawet gdy ktoś uruchomi go z dowolnym
`.env.local`. Testy integracyjne gadają z lokalnym stackiem albo nie uruchamiają się wcale.

## Zakres
- [ ] **Odczyt bieżącego stanu**: `grep -rln "createServiceClient\|\.env\.local" src --include=*.test.ts`
      — dziś pięć plików. Dla każdego ustal, czy faktycznie potrzebuje bazy, czy wystarczy mock
      (jak w `authorization.test.ts`). Lista z werdyktem do raportu.
- [ ] **`.env.test`** wskazujący na lokalny stack (`http://127.0.0.1:54421`, klucze lokalne
      z `supabase status`). Plik **commitowany** — lokalne klucze Supabase są takie same
      u każdego i nie są sekretem. Jeśli uznasz inaczej, **zatrzymaj się i zapytaj**.
- [ ] **`vitest.config.ts`** — `setupFiles` ładujący `.env.test` **przed** kodem testu,
      tak żeby żaden test nie musiał (ani nie mógł) czytać `.env.local` sam.
- [ ] **Bezpiecznik**: w `setupFiles` twardy warunek — jeśli `NEXT_PUBLIC_SUPABASE_URL`
      nie wskazuje na `127.0.0.1`/`localhost`, przerwij cały przebieg z czytelnym komunikatem.
      To jest sedno zadania: granica ma działać nawet wtedy, gdy ktoś źle skonfiguruje env.
- [ ] **Usuń ręczne parsowanie `.env.local`** z obu testów integracyjnych — env przychodzi
      z `setupFiles`.
- [ ] **Sprzątanie bezwarunkowe**: `afterAll` ma usuwać po sobie także wtedy, gdy asercja
      padła przed przypisaniem id (np. kasowanie po znaczniku w `angler_email`, nie po id).
- [ ] Wpis w `docs/deferred-tasks.md` pod FA-0.20 oznaczyć jako rozwiązany przez FA-0.21.

## Gotowe, gdy
- [ ] **Czerwony dowód**: ustaw tymczasowo w `.env.test` URL produkcji i uruchom `pnpm test --run`
      → przebieg **przerywa się** z komunikatem bezpiecznika, **zero zapytań do bazy**.
      Wklej komunikat. Przywróć `.env.test`. Bez tego dowodu kryterium jest niespełnione —
      „testy przechodzą lokalnie" niczego nie dowodzi.
- [ ] `grep -rn "\.env\.local" src --include=*.test.ts` → **0 trafień**.
- [ ] `pnpm test -- --run` przy wyłączonym lokalnym stacku → testy integracyjne **padają
      czytelnie** (nie wiszą dziesięć minut, jak 16 IX). Wklej wynik i czas.
- [ ] `pnpm test -- --run` przy działającym stacku → **62/62** (61 z `main` + ewentualny nowy).
      Jeśli liczba się różni, wyjaśnij którymi testami i dlaczego.
- [ ] Po pełnym przebiegu: `select count(*) from inquiries where angler_email like '%test%'
      or angler_email like '%regression%'` **na produkcji** → 0. Odczyt wykonuje tj.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` zielone.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Przepisywanie testów integracyjnych na jednostkowe z mockami — chyba że odczyt z Zakresu
  pokaże, że któryś bazy w ogóle nie potrzebuje; wtedy zgłoś i zapytaj.
- CI (`FA-1.11`) — to zadanie ma działać lokalnie, niezależnie od pipeline'u.
- Zmiany w `src/lib/supabase/server.ts` i w samym `createServiceClient()`.
- Rejestrator zdarzeń — FA-1.03.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Nie uruchamiaj `pnpm test` z `.env.local` wskazującym na produkcję, dopóki bezpiecznik
  nie działa. Jeśli musisz coś sprawdzić przed jego wprowadzeniem — **STOP**, zapytaj.
- Jeśli uznasz, że `.env.test` nie powinien być commitowany — **STOP**, przedstaw opcje.
- Nie usuwaj i nie wyłączaj żadnego testu, żeby przebieg był zielony — **STOP**, zgłoś.

## Weryfikacja
```
grep -rn "\.env\.local" src --include=*.test.ts          # 0
supabase status                                          # klucze lokalne do .env.test
pnpm test -- --run                                       # przy stacku: 62/62
# czerwony dowód: URL produkcji w .env.test -> przebieg przerwany przez bezpiecznik
pnpm typecheck && pnpm lint && pnpm build
```

## Notatki z realizacji
