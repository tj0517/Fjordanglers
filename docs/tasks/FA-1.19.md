---
id: FA-1.19
title: Skan sekretów w CI — gitleaks (przypięta wersja + suma kontrolna) jako bramka na PR; jednorazowy skan całej historii
stage: 1
status: todo
difficulty: S
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: chore/ci-secret-scan
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 2
owner: tj
---

# FA-1.19 — Skan sekretów w CI

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — sekcja „CI"
- `.github/workflows/ci.yml` — struktura jobów, wersje przypięte w `env:`
- `.env.test` — **commitowany celowo** (FA-0.21): lokalne, jawne klucze Supabase i placeholder `sk_test_…`; skaner go oznaczy
- `.gitignore` — `.env*` z wyjątkiem `!.env.test`
- `docs/05-agent-operations.md` §7 — sekrety
- Dokumentacja gitleaks (konfiguracja, allowlist, `--redact`, `--log-opts`) — przez context7, nie z pamięci

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Audyt z 22 IX sprawdził historię czterema wzorcami, a CI nie ma skanu sekretów wcale:
wklejony przypadkiem klucz przejdzie review i zostanie w historii na zawsze. Po zadaniu każdy
PR i push do `stage-1` przechodzi przez gitleaks, a znaleziony sekret czerwieni CI bez
wypisywania wartości. Jednorazowy skan całej historii odpowiada, czy repo jest czyste według
pełnego zestawu reguł.

## Zakres
- [ ] Odczyt stanu: `ci.yml`, `.env.test` (tylko nazwy zmiennych i typ wartości — bez wypisywania wartości w raporcie).
- [ ] Job `secrets` w `ci.yml`: gitleaks pobrany jako binarka w **przypiętej wersji** z weryfikacją **sha256** (bez `curl | sh`, bez niepinowanej akcji); na PR skanuje zakres `base..HEAD`, na pushu `before..after`; zawsze `--redact`.
- [ ] `.gitleaks.toml`: domyślne reguły + allowlist **po wartościach** (konkretne lokalne klucze z `.env.test` i placeholdery), a nie po ścieżce — nowy prawdziwy klucz wklejony do `.env.test` ma zostać wykryty.
- [ ] Tryb pełnej historii: `workflow_dispatch` z wejściem `full_history: true`, skanuje całą historię `stage-1`; tj uruchamia raz.
- [ ] `docs/03-conventions.md` „CI": opis joba, co robić przy trafieniu (sekret = wyciekły → rotacja, decyzja tj).

## Gotowe, gdy
- [ ] Wersja i suma przypięte: `grep -nE 'GITLEAKS_(VERSION|SHA256)' .github/workflows/ci.yml` → oba; krok kończy się błędem przy niezgodnej sumie — **dowód: przebieg z celowo złą sumą w gałęzi testowej (czerwony)**.
- [ ] Na czerwono (wykrycie): PR testowy z ewidentnie fałszywym kluczem w formacie wykrywanym przez domyślne reguły (np. `ghp_` + 36 losowych znaków, wygenerowany na potrzeby testu, nigdy prawdziwy) w pliku `src/` → job `secrets` czerwony, w logu wartość zredagowana — **link do przebiegu + fragment logu**. PR zamknięty bez merge, gałąź usunięta.
- [ ] Na czerwono (allowlist nie jest dziurą): ten sam fałszywy klucz dopisany do `.env.test` → nadal czerwony — **link do przebiegu**.
- [ ] Na zielono: PR bez zmian w sekretach (np. ten PR) → `secrets` zielony, `.env.test` nie zgłoszony — **link**.
- [ ] Skan pełnej historii (`workflow_dispatch`, uruchamia tj) → liczba trafień i ich reguły/ścieżki (bez wartości) w raporcie. **Każde trafienie poza allowlistą = STOP**, decyzja tj o rotacji; zadanie nie przechodzi do review, dopóki tj nie zdecyduje.
- [ ] Pozostałe joby CI bez zmian w zachowaniu; `pnpm typecheck && pnpm lint && pnpm test run` zielone.

## Poza zakresem
- GitHub secret scanning / push protection (ustawienia repo) — osobna decyzja tj
- Lokalny hook pre-commit
- Rotacja czegokolwiek, co skan historii znajdzie — decyzja tj (STOP)
- Przepisywanie historii git — **zakazane**
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Każde trafienie skanu historii poza allowlistą — pokaż regułę, plik, commit (bez wartości) i czekaj.
- Job `secrets` jako wymagany check w ochronie `stage-1` i `main` — zmianę ustawień repo robi tj po review.
- Dodanie akcji lub paczki zamiast binarki — decyzja tj (łańcuch dostaw).

## Weryfikacja
```
grep -nE 'GITLEAKS_(VERSION|SHA256)|--redact' .github/workflows/ci.yml
gh run list --workflow CI --limit 5
pnpm typecheck && pnpm lint && pnpm test run
```

## Notatki z realizacji
- 2026-09-22 tj: skan sekretów w CI (audyt agent-workflow). Pierwsza wersja pliku: commit `5b05b3fd` na `docs/workflow-wf-skills`; ta wersja ją zastępuje (wf-plan 22 IX).
- 2026-09-22 tj (wf-plan): zakres = bramka na nowe zmiany + jednorazowy skan całej historii (D4).
