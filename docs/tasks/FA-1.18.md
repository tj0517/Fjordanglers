---
id: FA-1.18
title: Środowisko dev — osobny projekt Supabase, migracje przez CI, Vercel Preview na dev
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-db
branch: chore/dev-environment
depends_on: []
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.18 — Środowisko dev

## Cel
Dziś FA ma tylko stack lokalny (odchudzony) i produkcję, więc podgląd wdrożenia (Vercel
Preview), integracje i testy e2e albo nie mają gdzie działać, albo dotykają prawdziwych
klientów. Po tym zadaniu jest drabina lokalne → dev → prod: migracje trafiają na dev
automatycznie, Preview czyta dev, a produkcja zmienia się tylko przez świadomy `db push`.
Decyzja tj 2026-09-22 (audyt agent-workflow, `core/environments.md`).

## Zakres
- [ ] Odczyt stanu: lista projektów Supabase organizacji, zmienne env w Vercel (Preview vs Production) — tylko odczyt
- [ ] **STOP:** utworzenie projektu `fjordanglers-dev` (region jak prod) — robi tj w dashboardzie albo agent po zgodzie; ref zapisany w `docs/01-architecture.md`
- [ ] Migracje z `supabase/migrations` zastosowane na dev przez CI (job na push do `stage-1`), nie ręcznie
- [ ] Seed syntetyczny na dev: konta ról `@seed.test`, przykładowe zapytania; **zero danych z prod**
- [ ] **STOP:** zmienne env Vercel dla środowiska Preview → dev (URL, anon key); Production bez zmian
- [ ] `.mcp.json`: serwer `supabase-dev` (read-only) obok `supabase-prod` — przez `agent-workflow/bin/mcp-render.py fa`
- [ ] `docs/05-agent-operations.md`: drabina środowisk w jednym akapicie

## Gotowe, gdy
- projekt dev istnieje i ma wszystkie migracje — **jak sprawdzić**: `list_migrations` na dev = lista plików w `supabase/migrations` (wklej obie)
- push do `stage-1` aplikuje nową migrację na dev bez ręcznego kroku — **jak sprawdzić**: link do runu CI + `list_migrations` po nim
- Preview czyta dev, nie prod — **jak sprawdzić**: zrzut `vercel env ls` (same nazwy i środowiska, bez wartości) + zapytanie z Preview widoczne w logach dev
- na dev nie ma danych osobowych z prod — **jak sprawdzić**: `select count(*) from auth.users where email not like '%@seed.test'` = 0
- red proof: job CI odmawia uruchomienia migracji, gdy ref ≠ dev — **jak sprawdzić**: run z podmienionym ref kończy się błędem

## Poza zakresem
- zmiana procesu `db push` na prod (zostaje ręczny, za bramką)
- kopiowanie danych z prod na dev w jakiejkolwiek formie

## Bramki STOP
- przed utworzeniem projektu Supabase (koszt planu) — decyzja tj
- przed każdą zmianą env w Vercel
- żadnego `db push` na prod w tym zadaniu

## Kontekst
- `docs/05-agent-operations.md` §9 — ograniczenia lokalnego stacku (8 GB)
- `.github/workflows/ci.yml` — istniejący job `db`
- `~/Documents/agent-workflow/core/environments.md` — drabina i zasady

## Notatki z realizacji
- 2026-09-22 tj: tworzymy dev (audyt agent-workflow, luka „brak środowiska dev”).
