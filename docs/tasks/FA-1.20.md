---
id: FA-1.20
title: CI dociera migracje na dev po merge do `stage-1` — pierwszy sekret w CI, w GitHub Environment `dev`
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: chore/ci-migrate-dev
depends_on: [FA-1.18]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 3
owner: tj
---

# FA-1.20 — CI wypycha migracje na dev

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — sekcja „CI"
- `.github/workflows/ci.yml` — nagłówek „ŻADEN SEKRET" i job `db`; to zadanie wprowadza pierwszy wyjątek i musi go opisać w nagłówku
- `docs/tasks/FA-1.18.md` — jak powstał dev i jaka jest ręczna procedura, którą ten job zastępuje
- `scripts/agent-guard.sh` — wzorzec `supabase db push` blokuje **każdą komendę powłoki zawierającą ten tekst**, także `grep` po pliku. Szukaj przez narzędzia do czytania plików, nie przez `grep` w Bash, albo szukaj fragmentu `db push`
- Dokumentacja Supabase CLI i GitHub Actions Environments — przez context7, nie z pamięci

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Po FA-1.18 dev dostaje migracje ręcznie od tj, więc łatwo się rozjedzie z repo i preview
zacznie sypać błędami schematu. Po tym zadaniu każdy merge do `stage-1` sam wypycha nowe
migracje na dev. Sekret z adresem bazy dev żyje tylko w GitHub Environment `dev`, dostępny
wyłącznie dla joba uruchamianego pushem do `stage-1` — nigdy dla PR. Produkcja zostaje
ręczna, za bramką.

## Zakres
- [ ] Odczyt stanu: `ci.yml`, `supabase migration list --db-url "$DEV_DB_URL"` (wykonuje tj, wynik do raportu).
- [ ] **tj (STOP):** GitHub → Settings → Environments → `dev`, deployment branches: tylko `stage-1`; sekret `DEV_DB_URL` (adres **poolera** Supabase w trybie session — runnery GitHub nie mają IPv6, a bezpośrednie połączenie Free jest IPv6).
- [ ] Job `migrate-dev` w `ci.yml`: `on: push` do `stage-1`, `environment: dev`, `needs:` na joby sprawdzające, `concurrency` bez anulowania (dwa merge nie ścigają się o bazę), ta sama wersja CLI co job `db`; wypycha migracje jawnym `--db-url`, bez `link`; potem `migration list` do summary.
- [ ] Nagłówek `ci.yml`: wyjątek od „ŻADEN SEKRET" opisany (jaki sekret, gdzie, kto ma dostęp, dlaczego nie PR).
- [ ] `docs/03-conventions.md` „CI" i podrozdział „Środowisko dev" w `docs/05` (z FA-1.18): ręczny krok zastąpiony jobem.

## Gotowe, gdy
- [ ] Merge PR z nową, nieszkodliwą migracją do `stage-1` → job `migrate-dev` zielony, w summary `migration list` z Local = Remote dla nowej migracji — **link do przebiegu**.
- [ ] Na czerwono (izolacja sekretu): przebieg na `pull_request` nie uruchamia `migrate-dev` (job „skipped") — **link do przebiegu PR**; `grep -n 'secrets\.' .github/workflows/ci.yml` → trafienia wyłącznie w jobie `migrate-dev`.
- [ ] Na czerwono (sekret nie wycieka): log przebiegu nie zawiera adresu bazy (Actions maskuje sekret; sprawdź, że komenda nie wypisuje URL w innej postaci, np. rozbitej) — **fragment logu**.
- [ ] Błąd migracji na dev czerwieni job (nie `continue-on-error`) — dowód: przebieg z celowo złym `DEV_DB_URL` w gałęzi testowej environmentu **albo** uzasadnienie w raporcie, czemu dowodu nie da się bezpiecznie wykonać, i decyzja tj.
- [ ] `pnpm typecheck && pnpm lint && pnpm test run` zielone; pozostałe joby CI bez zmian w zachowaniu.

## Poza zakresem
- Automatyczny `db push` na produkcję — zostaje ręczny, za bramką
- Seed w CI (seed na dev wgrywany raz w FA-1.18; ponowny seed to osobna decyzja)
- `supabase db diff --linked` wobec produkcji (wiersz FA-1.11 w deferred)
- Skan sekretów → FA-1.19
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Utworzenie environmentu i sekretu w GitHubie — robi tj.
- Każde uruchomienie migracji na dev poza jobem CI — robi tj.
- Zmiana reguł ochrony gałęzi / required checks — decyzja tj.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
gh run list --workflow CI --branch stage-1 --limit 3
gh run view <id> --log | grep -n migrate-dev | head
pnpm typecheck && pnpm lint && pnpm test run
```

## Notatki z realizacji
- 2026-09-22 tj (wf-plan): wydzielone z FA-1.18 (D2) — pierwszy sekret w CI osobną decyzją.
