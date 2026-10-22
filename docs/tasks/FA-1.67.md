---
id: FA-1.67
title: Worktree jedną komendą — `scripts/dev-env.sh`, `scripts/dev-preflight.sh`, §9 dla PC/WSL2
stage: 1
status: todo
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: chore/dev-env-scripts
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.67 — Worktree jedną komendą

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje
- `docs/05-agent-operations.md` §9 — dzisiejszy opis środowiska lokalnego (tylko Mac/OrbStack); tu dochodzi podsekcja PC/WSL2
- `src/lib/env.ts` — które zmienne są wymagane na starcie (`STRIPE_*`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`) i flaga `EXPERIENCE_V2_ENABLED`
- `.env.test` — placeholdery Stripe/Resend bezpieczne do commitu (wzorzec wartości)
- `.env.example` — lista zmiennych
- `scripts/agent-guard.sh` + `.claude/settings.json` (`deny`) — co agent może, a czego nie może robić z `.env*`
- `docs/deferred-tasks.md` wiersze FA-1.62 (OOM przy trzech stackach; `env.ts` wymaga Stripe) i FA-1.63 (EROFS, dysk C:) — skąd to zadanie

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Agent w świeżej worktree uruchamia `next dev` ze stroną v2 po jednej komendzie, bez rundy
z tj o plik env (FA-1.63: cztery rundy — klucze Supabase, atrapy Stripe/Resend, flaga v2,
sklejona linia). Przed `next dev` agent sam sprawdza, czy box nadaje się do kroku
przeglądarkowego (obce stacki Supabase, wolne miejsce na dysku), i zatrzymuje się, zamiast
wywalać WSL (20–21 X 2026: cztery restarty). §9 opisuje PC/WSL2, nie tylko Maca.

## Zakres
- [ ] Odczyt stanu: wymagane zmienne w `src/lib/env.ts`, zawartość `.env.test` (nazwy), reguły `deny` w `.claude/settings.json` i wzorce w `scripts/agent-guard.sh`; w notatkach: które komendy na `.env*` są dziś blokowane
- [ ] `scripts/dev-env.sh <katalog-worktree> [port=3001]`: pobiera `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` z `supabase status -o env`; dopisuje `NEXT_PUBLIC_APP_URL=http://localhost:<port>`, placeholdery `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY` (te same wartości co w `.env.test`), `RESEND_DEV_FAKE=1`, `EXPERIENCE_V2_ENABLED=true`; zapisuje `<katalog>/.env.development.local` z końcowym znakiem nowej linii; na stdout **tylko nazwy** zmiennych i ścieżkę pliku
- [ ] Odmowy `dev-env.sh` (exit 1 + komunikat): stack nie odpowiada (`supabase status` ≠ 0); URL z `supabase status` nie zaczyna się od `http://127.0.0.1` ani `http://localhost`; plik docelowy już istnieje (chyba że `--force`); w katalogu docelowym leży `.env.local` wskazujący prod (ostrzeżenie, nie blokada — `.env.development.local` nadpisuje go w `next dev`)
- [ ] `scripts/dev-preflight.sh [--min-free-gb=20]`: exit 1 z listą nazw, gdy `docker ps` pokazuje kontenery `supabase_*` nienależące do fjordanglers; exit 1, gdy wolne miejsce na `/` < próg; exit 1, gdy `docker ps` nie odpowiada w 10 s; exit 0 w innym razie, z jedną linią podsumowania
- [ ] `docs/05-agent-operations.md` §9: podsekcja „PC/WSL2 (10 GB RAM dla WSL, dysk C:)" — jeden projekt na boxie w trakcie kroku przeglądarkowego, `dev-preflight.sh` przed `next dev`, `dev-env.sh` dla każdej worktree, `.env.local` na PC = prod (nigdy do worktree), próg dysku; krótko, z odnośnikiem do skryptów zamiast ich opisu
- [ ] STOP — przed zmianą `.claude/settings.json` albo `scripts/agent-guard.sh`: pokaż diff i czekaj. Cel zmiany: agent może uruchomić `scripts/dev-env.sh` i `scripts/dev-preflight.sh`, nadal nie może czytać `.env*`
- [ ] `docs/deferred-tasks.md`: wiersze FA-1.62 „OOM przy trzech stackach" i FA-1.63 „EROFS/dysk" dostają dopisek „→ FA-1.67"; wiersz „`env.ts` wymaga Stripe" zostaje (decyzja tj 22 X 2026: generator wkłada atrapy, `env.ts` bez zmian)

## Gotowe, gdy
- [ ] W świeżej worktree (`git worktree add /tmp/fa-1.67-wt origin/main`) `scripts/dev-env.sh /tmp/fa-1.67-wt 3005` tworzy plik, a `next dev -p 3005` z tej worktree odpowiada na stronę pilota v2: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3005/experiences/seed-backcountry-day-nz` = `200` i `curl -s … | grep -c 'data-testid="offer-chips"'` ≥ 1 — **jak sprawdzić:** oba wyniki w raporcie; worktree po teście usunięta
- [ ] Stdout `dev-env.sh` nie zdradza wartości: `scripts/dev-env.sh … | grep -c '='` = `0` (nazwy i ścieżka, bez `=`); `grep -c '^EXPERIENCE_V2_ENABLED=true$' <plik>` = `1`, `tail -c1 <plik> | xxd` kończy się `0a` — **jak sprawdzić:** komendy w raporcie (uruchamia tj albo skrypt testowy; agent nie czyta `.env*`)
- [ ] Red proofy `dev-env.sh` (każdy exit 1 i komunikat, wklejone): stack zatrzymany (symulacja: `SUPABASE_STATUS_CMD=false`); URL nielokalny (symulacja: `SUPABASE_STATUS_CMD='printf "API_URL=https://uwxrstbplaoxfghrchcy.supabase.co\n"'`); plik już istnieje bez `--force` — **jak sprawdzić:** skrypt czyta komendę statusu ze zmiennej `SUPABASE_STATUS_CMD` (domyślnie `supabase status -o env`), test w `scripts/dev-env.test.sh` albo w vitest przez `execSync`
- [ ] Red proof `dev-preflight.sh`: `docker run -d --rm --name supabase_db_other alpine sleep 300` → exit 1 z `supabase_db_other` w wyjściu; po `docker rm -f supabase_db_other` exit 0; `scripts/dev-preflight.sh --min-free-gb=999999` → exit 1 z komunikatem o dysku — **jak sprawdzić:** trzy wywołania z kodami wyjścia w raporcie
- [ ] `docs/05-agent-operations.md` §9 ma podsekcję PC/WSL2 wymieniającą oba skrypty; `wc -c CLAUDE.md` < 8000 (jeśli CLAUDE.md w ogóle ruszone) — **jak sprawdzić:** `grep -n 'dev-preflight.sh\|dev-env.sh' docs/05-agent-operations.md`
- [ ] Agent uruchamia oba skrypty bez blokady guarda, a `cat .env.development.local` nadal zablokowany — **jak sprawdzić:** w raporcie wynik obu wywołań i wynik próby `cat` (odmowa guarda wklejona)
- [ ] CI zielone na head PR (`check`, `knip`, `db`, `secrets`) — lista w raporcie

## Poza zakresem
- Stripe opcjonalny w `env.ts` dla developmentu → zostaje w deferred (decyzja tj 22 X 2026)
- Zrzuty UI w CI (Playwright job, artefakty) → osobne zadanie M, do rozpisania
- Buckety Storage lokalnie, `next/image` dla 127.0.0.1, GA w devie → deferred FA-1.62 (289–291)
- RAM/swap/dysk na PC, `.wslconfig` → maszyna tj, nie repo
- Mac/OrbStack w §9 → bez zmian
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed zmianą `.claude/settings.json` lub `scripts/agent-guard.sh` — diff i akceptacja tj
- Skrypty nigdy nie wypisują wartości zmiennych; jeśli do diagnozy potrzebna jest wartość, zatrzymaj się

## Weryfikacja
```
scripts/dev-env.sh /tmp/fa-1.67-wt 3005 | tee /tmp/dev-env.out; grep -c '=' /tmp/dev-env.out
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3005/experiences/seed-backcountry-day-nz
SUPABASE_STATUS_CMD=false scripts/dev-env.sh /tmp/x; echo "exit=$?"
scripts/dev-preflight.sh; echo "exit=$?"
docker run -d --rm --name supabase_db_other alpine sleep 300 && scripts/dev-preflight.sh; echo "exit=$?"; docker rm -f supabase_db_other
grep -n 'dev-preflight.sh\|dev-env.sh' docs/05-agent-operations.md
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip
```

## Notatki z realizacji
- 2026-10-22 tj: zadanie z /wf-plan po FA-1.63 (cztery rundy o env, cztery restarty WSL 20–21 X). Stripe w `env.ts` bez zmian — generator wkłada atrapy. Próg dysku 20 GB domyślnie.
