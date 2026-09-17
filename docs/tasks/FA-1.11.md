---
id: FA-1.11
title: CI na PR do stage-1 i main — typecheck/lint/test/build, migracje aplikują się czysto, typy bez dryfu, stage-1 nie odstaje od main
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium-high
agent: fa-core
branch: chore/ci
depends_on: [FA-1.01]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.11 — CI

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md` — „CI runs `supabase db diff` and fails on drift"
- `docs/REBUILD_PLAN.md` §8 Etap 1 — `stage-1`, hotfixy z `main` cherry-pickowane tego samego dnia
- `docs/tasks/FA-0.21.md` — `.env.test`, bezpiecznik w `src/tests/setup.ts`, `vitest.config.ts`
- `package.json` (skrypty), `supabase/config.toml` (porty lokalnego stacku)
- `docs/05-agent-operations.md` §5 — format raportu; CI ma dawać te same dowody, które agent wkleja ręcznie

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Repo nie ma żadnego CI (`.github/workflows` nie istnieje). Przy paczce `stage-1` na jeden
push najgroźniejsze są trzy rzeczy: migracja, która nie aplikuje się na czysto; plik typów
rozjechany ze schematem; i `stage-1`, do którego nie trafił hotfix z `main`. Po zadaniu
każdy PR do `stage-1` i `main` jest sprawdzany automatycznie w tych trzech punktach plus
typecheck/lint/test/build, a PR do `stage-1` jest blokowany, gdy `main` ma commity spoza niego.

## Zakres
- [ ] Odczyt stanu: `ls .github`; wersje node/pnpm z `package.json`/`.nvmrc`; czas `pnpm build` lokalnie; czy `supabase start` działa bez sekretów (powinien — klucze deterministyczne z FA-0.21).
- [ ] `.github/workflows/ci.yml`, na `pull_request` do `main` i `stage-1` oraz `push` do `stage-1`:
  - job `check`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (env z `.env.test` + placeholdery dla zmiennych wymaganych przez `src/lib/env.ts` — bez prawdziwych sekretów).
  - job `db`: `supabase start` (cache obrazów), `supabase db reset` (wszystkie migracje na czysto), `supabase db diff --local` → musi być pusty; `supabase gen types typescript --local > /tmp/types.ts` i `diff` z `src/lib/supabase/database.types.ts` → pusty; `pnpm test` przeciwko lokalnemu stackowi.
  - job `sync` (tylko PR do `stage-1`): `git merge-base --is-ancestor origin/main HEAD` — fail z czytelnym komunikatem „stage-1 nie zawiera main; zmerguj main do stage-1".
- [ ] Skrypt `supabase:types` w `package.json`: dodaj `supabase:types:local` (`--local`); istniejący (`--project-id`) zostaje do użycia po pushu.
- [ ] `docs/03-conventions.md`: krótka sekcja „CI" (co sprawdza, jak naprawić każdy z trzech failów).
- [ ] Branch protection na `stage-1` i `main` z wymaganymi checkami — instrukcja w raporcie (ustawia tj w GitHub; poza zasięgiem agenta).

## Gotowe, gdy
- [ ] PR testowy z celowo złą migracją (np. `ALTER TABLE nope ADD x int`) → job `db` czerwony — **na czerwono, link do runu w raporcie**.
- [ ] PR testowy z ręczną edycją `database.types.ts` → job `db` czerwony (diff typów) — **na czerwono**.
- [ ] PR testowy do `stage-1` z gałęzi bez najnowszego `main` → job `sync` czerwony — **na czerwono**.
- [ ] PR z czystą gałęzią → wszystkie joby zielone, link do runu w raporcie; czas całości < 15 min.
- [ ] Żaden sekret produkcyjny nie jest w workflow ani w secrets repo (raport: lista użytych secrets = pusta lub tylko lokalne).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone lokalnie.

## Poza zakresem
- Sprawdzanie dryfu wobec **produkcji** (`db diff --linked`) — wymaga hasła bazy w secrets; decyzja tj, osobne zadanie.
- Deploy z CI (Vercel robi to sam), `db push` z CI — nigdy w etapie 1.
- E2E Playwright w CI — później.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Dodanie jakiegokolwiek secretu do repo/GitHub: STOP, zapytaj.
- Zmiana ustawień branch protection: robi tj.

## Weryfikacja
```
act -l 2>/dev/null || echo "run via GitHub"
pnpm typecheck && pnpm lint && pnpm test && pnpm build
supabase db reset && supabase db diff --local
supabase gen types typescript --local | diff - src/lib/supabase/database.types.ts && echo TYPES-OK
```

## Notatki z realizacji
