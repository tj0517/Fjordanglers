---
id: FA-1.78
title: CI — ponawianie `supabase start` w jobie `db` (ghcr.io dławi pobieranie obrazów)
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

# FA-1.78 — CI: ponawianie `supabase start` w jobie `db`

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje
- `.github/workflows/ci.yml` — job `db` (`supabase/setup-cli` → `supabase start -x …`), `permissions: contents: read` na poziomie workflow, nagłówek (l. 12–18) o braku sekretów (FA-1.20)
- `.github/workflows/deploy-db.yml` — tylko do potwierdzenia, że nie startuje lokalnego stacku (bez zmian)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Job `db` na PR #169 (FA-1.77) padł dwa razy z rzędu na `supabase start`: pobieranie `ghcr.io/supabase/postgres:17.6.1.075` kończy się `toomanyrequests` (27 X 2026). Logowanie do ghcr.io tego nie naprawia (PR #170, run 40535196066: `Login Succeeded!`, potem znowu `toomanyrequests … allowed: 44000/minute`) — dławienie jest po stronie ghcr.io, nie limit anonimowy na IP. Po zadaniu job `db` próbuje `supabase start` do 3 razy (przerwy 30 s, potem 60 s, `supabase stop --no-backup || true` między próbami) i pada dopiero po trzeciej. Bez sekretów, bez tokenu, bez `permissions` na jobie; `SUPABASE_INTERNAL_IMAGE_REGISTRY` bez zmian.

## Zakres
- [ ] Odczyt stanu: job `db` w `ci.yml` (kolejność kroków, `permissions`), nagłówek pliku; `deploy-db.yml` nie robi `supabase start` — grep wklejony.
- [ ] Logowanie do ghcr.io, `permissions` joba `db` i zmiana linii nagłówka — wycofane (decyzja tj 27 X 2026).
- [ ] Krok `supabase start` w jobie `db`: pętla 3 prób, przerwy 30 s i 60 s, `supabase stop --no-backup || true` między próbami, błąd po trzeciej; komentarz po polsku z powodem i datą; `timeout-minutes: 20` bez zmian.
- [ ] Wskazać (jedna linia), gdzie `SUPABASE_INTERNAL_IMAGE_REGISTRY` dostaje `ghcr.io`.
- [ ] Zmiana rejestru (opcja B) → `docs/deferred-tasks.md` jako następny krok, jeśli ponowienia nie wystarczą.

## Gotowe, gdy
- [ ] Job `db` zielony na head PR, w logu widać, że pętla ponowień zadziałała (próba 1 OK albo komunikat o ponowieniu) — wklejony fragment.
- [ ] `grep -n 'secrets\.\|github.token\|packages:' .github/workflows/ci.yml` pusty — wklejony.
- [ ] Diff `ci.yml` = tylko krok `supabase start` z pętlą — wklejony `--stat` i diff.
- [ ] CI zielone na head PR (`check`, `knip`, `db`, `secrets`) — lista wklejona.
- [ ] Jedna linia: czy czerwony Vercel na #170 to znany wiersz deferred z FA-1.74 (brak klucza Supabase na Preview).

Red proof dla pętli: lokalnie, z atrapą `supabase` (pada zawsze → exit 1 po 3 próbach). Samego dławienia ghcr.io nie da się wywołać na żądanie.

## Poza zakresem
- Cache obrazów Dockera, zmiana rejestru obrazów Supabase, podniesienie `SUPABASE_CLI_VERSION`.
- Zmiany w `deploy-db.yml`, w jobach `check`, `knip`, `sync`, `secrets`, w ustawieniach repo / Environments.
- Nowe sekrety (PAT itp.).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Nowy sekret, PAT, `secrets.*` w `ci.yml` albo zmiana ustawień repo / Environments — STOP, decyzja tj.
- Jakiekolwiek `permissions` na jobie `db` albo zmiana `permissions` workflow — STOP.

## Weryfikacja
```
git diff origin/main... -- .github/
grep -n 'secrets\.\|github.token\|packages:' .github/workflows/ci.yml   # pusty
```
Plus log joba `db` z GitHub Actions.

## Notatki z realizacji
- **2026-10-27, tj:** zadanie założone po dwóch czerwonych `db` na PR #169 (`toomanyrequests` z ghcr.io); osobne małe zadanie zamiast łatania w PR #169; plik zadania zakłada agent w pierwszym commicie (skrót zamiast osobnego PR z dokumentacją — decyzja tj).
- **2026-10-27, tj — decyzja B:** token przebiegu jako `${{ github.token }}`, nie `secrets.GITHUB_TOKEN` — nagłówek `ci.yml` „zero `secrets.*`” (FA-1.20) zostaje prawdziwy i sprawdzalny jednym grepem; jedna linia nagłówka przeformułowana.
- **2026-10-27, agent — wynik logowania:** PR #170, run 40535196066, job `db`: krok `docker/login-action@v3` → `Login Succeeded!` (log l. 301), potem `supabase start` → `toomanyrequests: retry-after: 561.535µs, allowed: 44000/minute` przy `ghcr.io/supabase/postgres:17.6.1.075` (l. 321–329). CLI `2.75.0` wysyła zapisane dane logowania przy pobieraniu (`internal/utils/docker.go:167`, `GetRegistryAuth`), więc pobranie było zalogowane — logowanie nie pomaga. `ghcr.io` ustawia `supabase/setup-cli` (`src/main.ts:67` przy SHA `1dedf2c`: `core.exportVariable(CLI_CONFIG_REGISTRY, 'ghcr.io')`); domyślny rejestr CLI to `public.ecr.aws`.
- **2026-10-27, tj — zmiana zakresu:** logowanie i `packages: read` usunięte (dowiedzione, że nie pomagają; nagłówek `ci.yml` wraca do stanu z `main`). Zamiast tego 3 próby `supabase start` (30 s, 60 s, `supabase stop --no-backup || true` między), `timeout-minutes: 20` bez zmian, `SUPABASE_INTERNAL_IMAGE_REGISTRY` bez zmian. Zmiana rejestru (opcja B) → deferred jako następny krok, jeśli ponowienia nie wystarczą.
