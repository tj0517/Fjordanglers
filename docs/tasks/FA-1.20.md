---
id: FA-1.20
title: Migracje przez GitHub Actions — `deploy-db.yml`: dev po merge do `main`, prod ręcznie za bramką Environment `production-db` (wzór DCS)
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: chore/deploy-db-workflow
pr: 152
depends_on: [FA-1.18]
blocked_by_questions: []
touches_db: true
touches_prod: true
estimate_h: 4
owner: tj
---

# FA-1.20 — Migracje przez GitHub Actions (dev auto, prod za bramką)

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — sekcja „CI"
- `.github/workflows/ci.yml` — nagłówek „ŻADEN SEKRET" i job `db` (wersja CLI, setup); ten plik **nie** dostaje sekretów — sekrety żyją tylko w nowym `deploy-db.yml`
- `docs/tasks/FA-1.18.md` — jak powstał dev; ręczna procedura `db push --db-url`, którą zastępuje job
- `docs/05-agent-operations.md` §3 (bramki) i podrozdział „Środowisko dev"
- `scripts/agent-guard.sh` — wzorzec `supabase db push` blokuje każdą komendę powłoki z tym tekstem, także `grep`; szukaj przez narzędzia do czytania plików albo po fragmencie `db push`
- Wzorzec do skopiowania: `Seaclouds_management_system/.github/workflows/deploy-db.yml` (repo DCS, na PC w `~/Seaclouds_management_system`) — ten sam schemat: job dev na push, job prod na `workflow_dispatch` z `environment: production-db`
- Dokumentacja Supabase CLI i GitHub Environments — context7, nie z pamięci

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś `db push` na prod robi tj ręcznie z Maca (hasło do bazy w CLI; 22 X 2026 push FA-1.63 nie
przeszedł, bo zapisane hasło się nie zgadza), a dev dostaje migracje ręcznie od FA-1.18.
Po tym zadaniu: każdy merge do `main` sam wypycha nowe migracje na dev; na prod migracje
wchodzą wyłącznie przez `workflow_dispatch` w GitHub Environment `production-db` z wymaganym
zatwierdzeniem tj — klik „Approve" zamiast terminala, log każdego pushu w Actions, hasła do
bazy nie ma na żadnej maszynie. `agent-guard.sh` przestaje być jedyną bramką. Pierwszym
pushem przez Action jest `20261011000000_experience_hero_facts.sql` (FA-1.63 czeka w `review`).

## Zakres
- [ ] Odczyt stanu: `ci.yml` (job `db`, wersja CLI), `supabase migration list --db-url "$DEV_DB_URL"` (wykonuje tj, wynik do raportu), lista migracji na prod przez supabase-prod MCP (`list_migrations`)
- [ ] **tj (STOP):** GitHub → Settings → Environments: `fev` (= dev; nazwa wg decyzji tj 2026-10-22) (deployment branches: tylko `main`; sekret `DEV_DB_URL` — adres **poolera**, tryb session, bo runnery nie mają IPv6) i `production-db` (required reviewers: tj; deployment branches: tylko `main`; sekret `PROD_DB_URL`, pooler). Agent przygotowuje instrukcję, tj wykonuje
- [ ] Nowy `.github/workflows/deploy-db.yml` (wzór DCS): job `migrate-dev` — `on: push: branches: [main]`, `paths: [supabase/migrations/**]`, `environment: fev`, `concurrency` bez anulowania, ta sama wersja CLI co job `db`, `supabase db push --db-url "$DEV_DB_URL"` bez `link`, potem `migration list` do summary; job `migrate-prod` — wyłącznie `on: workflow_dispatch` z `environment: production-db`, krok `db push --dry-run` do summary **przed** krokiem push, `migration list` po; żadnego `continue-on-error`
- [ ] Nagłówek `ci.yml` i `deploy-db.yml`: zasada „sekrety tylko w `deploy-db.yml`, tylko w Environments, nigdy w jobach `pull_request`" opisana w jednym miejscu
- [ ] `docs/03-conventions.md` „CI", `docs/05` §3 (bramka STOP przy migracji: „merge dopiero po zastosowaniu migracji" → „merge, potem `workflow_dispatch` prod i zatwierdzenie tj; kod nie może wymagać kolumny przed pushem — albo migracja wchodzi przed merge'em, kolejność decyduje tj per zadanie") i „Środowisko dev": ręczne kroki zastąpione jobami; `envs.prod.migrations` w `agent-workflow/projects/fa/project.md` aktualizuje tj
- [ ] `docs/tasks/README.md` i `docs/tasks/_template.md`: bramka „`db push` na prod wyłącznie tj" → „na prod wyłącznie przez `deploy-db.yml` (`workflow_dispatch`, zatwierdza tj)"

## Gotowe, gdy
- [ ] Merge do `main` z nową migracją (może być migracja FA-1.63 po jej merge'u — kolejność: decyzja tj w notatkach) → `migrate-dev` zielony, summary z `migration list` Local = Remote — **link do przebiegu**
- [ ] `workflow_dispatch` `migrate-prod` **czeka** na zatwierdzenie (status „Waiting" w Actions, zrzut), po „Approve" tj push przechodzi, summary pokazuje dry-run i `migration list` — **link do przebiegu**; po nim `list_migrations` przez supabase-prod MCP zawiera nową migrację — **wklej wynik**
- [ ] Na czerwono (bramka): uruchomienie `migrate-prod` bez zatwierdzenia nie wykonuje pushu — dowód: przebieg odrzucony („Reject") kończy się bez kroku push, log wklejony
- [ ] Na czerwono (izolacja sekretów): przebieg `pull_request` nie uruchamia żadnego joba z `deploy-db.yml` (brak w checkach PR — link); `grep -n 'secrets\.' .github/workflows/ci.yml` → 0 trafień; `grep -n 'secrets\.' .github/workflows/deploy-db.yml` → trafienia tylko w krokach z `environment`
- [ ] Na czerwono (sekret nie wycieka): logi obu jobów nie zawierają adresu bazy w żadnej postaci (maskowanie + komenda nie wypisuje URL) — **fragment logu**
- [ ] Błąd migracji czerwieni job: przebieg `migrate-dev` z celowo błędnym `DEV_DB_URL` w gałęzi testowej environmentu → czerwony — **link**, albo uzasadnienie i decyzja tj
- [ ] `pnpm typecheck && pnpm lint && pnpm test run` zielone; CI na head PR (`check`, `knip`, `db`, `secrets`) — lista w raporcie

## Poza zakresem
- Automatyczny push na prod po merge (bez zatwierdzenia) — nie; bramka zostaje
- Seed na dev w CI — osobna decyzja
- `supabase db diff --linked` wobec produkcji — deferred FA-1.11
- Vercel Preview na dev — FA-1.18 / FA-1.75
- Skan sekretów — FA-1.19 (done)
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Environments i sekrety w GitHubie tworzy tj; agent nie zna adresów baz
- Każde uruchomienie `migrate-prod` — wyłącznie tj (Approve); agent nie wywołuje `gh workflow run deploy-db.yml` dla joba prod
- Zmiana reguł ochrony gałęzi / required checks — decyzja tj
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów

## Weryfikacja
```
gh run list --workflow deploy-db.yml --limit 5
gh run view <id> --log | grep -n 'migrate-\(dev\|prod\)' | head
grep -n 'secrets\.' .github/workflows/ci.yml .github/workflows/deploy-db.yml
pnpm typecheck && pnpm lint && pnpm test run
```

## Notatki z realizacji
- 2026-09-22 tj (wf-plan): wydzielone z FA-1.18 (D2) — pierwszy sekret w CI osobną decyzją.
- 2026-10-22 tj: przepisane — `stage-1` → `main`, osobny `deploy-db.yml` jak w DCS, prod w zakresie za bramką Environment `production-db`. FA-1.63 (PR #150) czeka w `review` na pierwszy push przez Action; ręcznego pusha nie robimy.
- 2026-10-22 tj: w tym zadaniu `gh` CLI zamiast serwera github MCP (`gh` uwierzytelniony; token MCP odrzucany — `Bad credentials` po wymianie tokenu i restarcie). Wiersz w `docs/deferred-tasks.md`.
- 2026-10-22 tj: `paths` — opcja B: `supabase/migrations/**` plus `.github/workflows/deploy-db.yml`, jak w DCS (merge tego PR uruchamia `migrate-dev` bez nowej migracji — dowód okablowania). Pierwszy dispatch `migrate-prod` bez oczekujących migracji: dowód Waiting / Approve / pusty dry-run i czerwony dowód Reject.
- 2026-10-22 tj: README / szablon — w `docs/tasks/README.md` i `_template.md` nie było zdania „`db push` na prod wyłącznie tj"; nowe brzmienie bramki dopisane w README pkt 6 „Bramki STOP" i w sekcji „Bramki STOP" szablonu.
- 2026-10-22 tj: brak refu dev w `docs/05` §11 — wiersz w `docs/deferred-tasks.md`, nie poprawiane tutaj.
- 2026-10-22 tj (dla porządku, poza zadaniem): FA-1.63 — migracja idzie na prod osobnym PR-em tylko z migracją, przed merge'em #150, bo nowe zapytanie wybiera `hero_facts` i bez kolumny dałoby 500 na prod.
- 2026-10-22 tj: Environment bazy dev zostaje nazwany `fev` (GitHub nie zmienia nazw Environments) — `environment: fev` w workflow; `fev` w `docs/03` „CI", `docs/05` §11 i w tym pliku; w §11 linijka, że `fev` = Environment bazy dev.
- 2026-10-22 tj: czerwony dowód „błąd czerwieni job" — opcja A: Environment `dev-red` (deployment branch `fa-1.20-red`, fałszywy `DEV_DB_URL` na nieistniejący host), gałąź `fa-1.20-red` z kopią workflow; po dowodzie gałąź i Environment do usunięcia.
- 2026-10-22 agent: czerwony dowód A wykonany — przebiegi 39759758129 i 39759894145 (gałąź `fa-1.20-red`, usunięta). Pierwszy pokazał, że maska na 1-znakowym fałszywym haśle psuje log („e***it") → maskowane są tylko części ≥ 4 znaki (17b9326). Environment `dev-red` do usunięcia przez tj.
- 2026-10-22 tj: obie obserwacje do `docs/deferred-tasks.md` pod FA-1.20 (dry-run widoczny dopiero po Approve; Node 20 / `ubuntu-latest` → 26). `dev-red` usunięty przez tj.
- 2026-10-22 tj: zamknięcie — opcja (b): zadanie zostaje w `review`, tj merguje #152 bez zmian; po merge'u agent dopisuje do opisu PR trzy dowody (`migrate-dev` — 6 migracji na dev, `migrate-prod` Waiting → Approve, przebieg Reject). Linie `done` idą w pierwszym commicie następnego zadania FA (wg `docs/tasks/README.md`).
- 2026-10-22 tj: accepted; closed in FA-1.63's branch per README
