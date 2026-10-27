---
id: FA-1.78
title: CI — logowanie do ghcr.io przed `supabase start` w jobie `db` (limit anonimowych pobrań obrazów)
stage: 1
status: in_progress
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: ci/fa-1.78-ghcr-login
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 1
owner: tj
---

# FA-1.78 — CI: logowanie do ghcr.io w jobie `db`

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje
- `.github/workflows/ci.yml` — job `db` (`supabase/setup-cli` → `supabase start -x …`), `permissions: contents: read` na poziomie workflow, nagłówek (l. 12–18) o braku sekretów (FA-1.20)
- `.github/workflows/deploy-db.yml` — tylko do potwierdzenia, że nie startuje lokalnego stacku (bez zmian)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Job `db` na PR #169 (FA-1.77) padł dwa razy z rzędu na `supabase start`: pobieranie `ghcr.io/supabase/postgres:17.6.1.075` kończy się `toomanyrequests` (27 X 2026). CI pobiera obrazy z ghcr.io anonimowo, a anonimowy limit dzieli IP runnera z innymi. Po zadaniu job `db` loguje się do ghcr.io tokenem przebiegu (`github.token`) przed `supabase start`. Bez nowych sekretów; `secrets.*` dalej nie występuje w `ci.yml`.

## Zakres
- [ ] Odczyt stanu: job `db` w `ci.yml` (kolejność kroków, `permissions`), nagłówek pliku; `deploy-db.yml` nie robi `supabase start` — grep wklejony.
- [ ] W jobie `db`, między `setup-cli` a `supabase start`: `docker/login-action@v3` (`registry: ghcr.io`, `username: ${{ github.actor }}`, `password: ${{ github.token }}`), komentarz po polsku z powodem i datą.
- [ ] `permissions` na jobie `db`: `contents: read` + `packages: read`; workflow-level bez zmian.
- [ ] Nagłówek `ci.yml` (l. 15): przeformułować „którego tu nie używamy” — token przebiegu jest używany wyłącznie do pobrania obrazów w jobie `db`; obietnica „zero `secrets.*`” zostaje prawdziwa.

## Gotowe, gdy
- [ ] Job `db` zielony na head PR, w logu krok logowania z `Login Succeeded` — wklejony fragment.
- [ ] `grep -n 'secrets\.' .github/workflows/ci.yml` pusty — wklejony.
- [ ] Diff `ci.yml` = krok logowania + `permissions` joba `db` + jedna linia nagłówka — wklejony `--stat` i diff.
- [ ] CI zielone na head PR (`check`, `knip`, `db`, `secrets`) — lista wklejona.

Red proof nie ma sensu (limitu nie da się wywołać na żądanie) — dowodem jest log logowania i zielony `db`.

## Poza zakresem
- Cache obrazów Dockera, zmiana rejestru obrazów Supabase, podniesienie `SUPABASE_CLI_VERSION`.
- Zmiany w `deploy-db.yml`, w jobach `check`, `knip`, `sync`, `secrets`, w ustawieniach repo / Environments.
- Nowe sekrety (PAT itp.).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Nowy sekret, PAT, `secrets.*` w `ci.yml` albo zmiana ustawień repo / Environments — STOP, decyzja tj.
- Szersze `permissions` niż `contents: read` + `packages: read` na jobie `db` — STOP.

## Weryfikacja
```
git diff origin/main... -- .github/
grep -n 'secrets\.' .github/workflows/ci.yml   # pusty
```
Plus log joba `db` z GitHub Actions.

## Notatki z realizacji
- **2026-10-27, tj:** zadanie założone po dwóch czerwonych `db` na PR #169 (`toomanyrequests` z ghcr.io); osobne małe zadanie zamiast łatania w PR #169; plik zadania zakłada agent w pierwszym commicie (skrót zamiast osobnego PR z dokumentacją — decyzja tj).
- **2026-10-27, tj — decyzja B:** token przebiegu jako `${{ github.token }}`, nie `secrets.GITHUB_TOKEN` — nagłówek `ci.yml` „zero `secrets.*`” (FA-1.20) zostaje prawdziwy i sprawdzalny jednym grepem; jedna linia nagłówka przeformułowana.
