---
id: FA-1.78
title: CI — obrazy lokalnego stacku z public.ecr.aws + ponawianie `supabase start` w jobie `db` (ghcr.io dławi pobieranie)
stage: 1
status: in_progress
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: ci/fa-1.78-ghcr-login
pr: 170
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 1
owner: tj
---

# FA-1.78 — CI: obrazy z public.ecr.aws i ponawianie `supabase start` w jobie `db`

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje
- `.github/workflows/ci.yml` — job `db` (`supabase/setup-cli` → `supabase start -x …`), `permissions: contents: read` na poziomie workflow, nagłówek (l. 12–18) o braku sekretów (FA-1.20)
- `.github/workflows/deploy-db.yml` — tylko do potwierdzenia, że nie startuje lokalnego stacku (bez zmian)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Job `db` na PR #169 (FA-1.77) padł dwa razy z rzędu na `supabase start`: pobieranie `ghcr.io/supabase/postgres:17.6.1.075` kończy się `toomanyrequests` (27 X 2026). Logowanie do ghcr.io nie pomaga (run 40535196066), trzy próby w ~2,5 min też nie (run 40580173414) — ghcr.io dławił ten obraz ponad 6 h. Po zadaniu job `db` pobiera obrazy Supabase z `public.ecr.aws` (domyślny rejestr CLI; `setup-cli` wymusza ghcr.io dla CLI 2.75.0), ustawione przez `$GITHUB_ENV` zaraz po `setup-cli`, więc obowiązuje w każdym następnym kroku (`start`, `db reset`, `db diff`, `gen types`). Ponawianie `supabase start` zostaje (3 próby, 30 s / 60 s, `supabase stop --no-backup || true` między). Bez sekretów, bez tokenu, bez `permissions` na jobie.

## Zakres
- [ ] Odczyt stanu: job `db` w `ci.yml` (kolejność kroków, `permissions`), nagłówek pliku; `deploy-db.yml` nie robi `supabase start` — grep wklejony.
- [ ] Logowanie do ghcr.io, `permissions` joba `db` i zmiana linii nagłówka — wycofane (decyzja tj 27 X 2026).
- [ ] Krok `supabase start` w jobie `db`: pętla 3 prób, przerwy 30 s i 60 s, `supabase stop --no-backup || true` między próbami, błąd po trzeciej; komentarz po polsku z powodem i datą; `timeout-minutes: 20` bez zmian.
- [ ] Krok zaraz po `setup-cli`: `SUPABASE_INTERNAL_IMAGE_REGISTRY=public.ecr.aws` do `$GITHUB_ENV`, komentarz po polsku z powodem (runy, `setup-cli` `src/main.ts:67`); `supabase start` wypisuje `registry=$SUPABASE_INTERNAL_IMAGE_REGISTRY`.
- [ ] Wskazać (jedna linia), gdzie `SUPABASE_INTERNAL_IMAGE_REGISTRY` dostaje `ghcr.io`.
- [ ] Wiersz deferred „zmiana rejestru” zamknięty w tym PR.

## Gotowe, gdy
- [ ] Job `db` zielony na head PR; w logu `registry=public.ecr.aws`, obrazy pobrane z `public.ecr.aws`, widać pętlę ponowień (próba 1 OK albo komunikat o ponowieniu) — wklejony fragment.
- [ ] `grep -nE '\$\{\{ *(secrets\.|github\.token)|^\s*packages:' .github/workflows/ci.yml` pusty — wklejony.
- [ ] Diff `ci.yml` = krok z rejestrem + krok `supabase start` z pętlą — wklejony `--stat` i diff.
- [ ] CI zielone na head PR (`check`, `knip`, `db`, `secrets`) — lista wklejona.
- [ ] Jedna linia: czy czerwony Vercel na #170 to znany wiersz deferred z FA-1.74 (brak klucza Supabase na Preview).

Red proof dla pętli: lokalnie, z atrapą `supabase` (pada zawsze → exit 1 po 3 próbach). Dławienia rejestru nie da się wywołać na żądanie. Jeśli pierwszy przebieg padnie na brakującym tagu albo „registry fallback” w public.ecr.aws — STOP, log do tj, bez prób kolejnych rejestrów.

## Poza zakresem
- Cache obrazów Dockera, podniesienie `SUPABASE_CLI_VERSION`, rejestry inne niż ghcr.io / public.ecr.aws.
- Zmiany w `deploy-db.yml`, w jobach `check`, `knip`, `sync`, `secrets`, w ustawieniach repo / Environments.
- Nowe sekrety (PAT itp.).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Nowy sekret, PAT, `secrets.*` w `ci.yml` albo zmiana ustawień repo / Environments — STOP, decyzja tj.
- Jakiekolwiek `permissions` na jobie `db` albo zmiana `permissions` workflow — STOP.

## Weryfikacja
```
git diff origin/main... -- .github/
grep -nE '\$\{\{ *(secrets\.|github\.token)|^\s*packages:' .github/workflows/ci.yml   # pusty
```
Plus log joba `db` z GitHub Actions.

## Notatki z realizacji
- **2026-10-27, tj:** zadanie założone po dwóch czerwonych `db` na PR #169 (`toomanyrequests` z ghcr.io); osobne małe zadanie zamiast łatania w PR #169; plik zadania zakłada agent w pierwszym commicie (skrót zamiast osobnego PR z dokumentacją — decyzja tj).
- **2026-10-27, tj — decyzja B:** token przebiegu jako `${{ github.token }}`, nie `secrets.GITHUB_TOKEN` — nagłówek `ci.yml` „zero `secrets.*`” (FA-1.20) zostaje prawdziwy i sprawdzalny jednym grepem; jedna linia nagłówka przeformułowana.
- **2026-10-27, agent — wynik logowania:** PR #170, run 40535196066, job `db`: krok `docker/login-action@v3` → `Login Succeeded!` (log l. 301), potem `supabase start` → `toomanyrequests: retry-after: 561.535µs, allowed: 44000/minute` przy `ghcr.io/supabase/postgres:17.6.1.075` (l. 321–329). CLI `2.75.0` wysyła zapisane dane logowania przy pobieraniu (`internal/utils/docker.go:167`, `GetRegistryAuth`), więc pobranie było zalogowane — logowanie nie pomaga. `ghcr.io` ustawia `supabase/setup-cli` (`src/main.ts:67` przy SHA `1dedf2c`: `core.exportVariable(CLI_CONFIG_REGISTRY, 'ghcr.io')`); domyślny rejestr CLI to `public.ecr.aws`.
- **2026-10-27, tj — zmiana zakresu:** logowanie i `packages: read` usunięte (dowiedzione, że nie pomagają; nagłówek `ci.yml` wraca do stanu z `main`). Zamiast tego 3 próby `supabase start` (30 s, 60 s, `supabase stop --no-backup || true` między), `timeout-minutes: 20` bez zmian, `SUPABASE_INTERNAL_IMAGE_REGISTRY` bez zmian. Zmiana rejestru (opcja B) → deferred jako następny krok, jeśli ponowienia nie wystarczą.
- **2026-10-28, agent — wynik ponowień:** run 40580173414, job `db`: trzy próby (`próba 1/3` → 30 s → `2/3` → 60 s → `3/3`), każda `toomanyrequests` na `ghcr.io/supabase/postgres:17.6.1.075` (6 ponowień CLI, wszystkie na tym jednym obrazie; postgrest/kong/gotrue pobrane); `db` czerwony na każdym przebiegu od 14:42 UTC 27 X. Z maszyny tj bez logowania manifest `supabase/postgres:17.6.1.075` → 200 i w ghcr.io, i w public.ecr.aws.
- **2026-10-28, tj — decyzja 1 (A):** zmiana zakresu — obrazy z `public.ecr.aws`, ponawianie zostaje; wiersz deferred „zmiana rejestru” zamknięty w tym PR. Brakujący tag albo „registry fallback” w pierwszym przebiegu → STOP i log, bez kolejnych rejestrów.
- **2026-10-28, tj — decyzja 2:** kryterium grepa zamienione na `grep -nE '\$\{\{ *(secrets\.|github\.token)|^\s*packages:'` (musi być pusty) — stary grep łapał trzy linie z `main` (nagłówek l. 14, tekst summary w `check` l. 93, komentarz joba `secrets`), których to zadanie nie dotyka.
- **2026-10-28, tj — decyzja A (miejsce ustawienia):** rejestr przez `$GITHUB_ENV` w osobnym kroku zaraz po `setup-cli`, nie `env:` samego kroku `supabase start` — `db reset`, `db diff --local` i `gen types --local` też pobierają obrazy (zielony run #169: edge-runtime, postgres-meta). `supabase start` wypisuje `registry=…`, żeby log pokazywał efektywny rejestr.
- **2026-10-28, tj:** accepted — close it (review PR #170, CI zielone na `f5509dd`).
- **2026-10-28, tj — ponowne otwarcie:** run 40663905106 (head `8eec31b`, job `db`): public.ecr.aws → `toomanyrequests: Data limit exceeded` na postgres, postgrest, kong i gotrue, we wszystkich 3 próbach. Decyzja tj: usunąć krok z `$GITHUB_ENV`; w pętli rejestr per próba (1: ghcr.io, 2: public.ecr.aws, 3: ghcr.io; 30 s / 60 s, `supabase stop --no-backup || true` między), echo rejestru w każdej próbie, po udanym starcie zwycięski rejestr do `$GITHUB_ENV` (dla `db reset` / `db diff` / `gen types`). Bez sekretów, logowań i zmian `permissions`. Cache obrazów między przebiegami → deferred, jeśli naprzemienne rejestry nie wystarczą. Status z powrotem `in_progress`.
